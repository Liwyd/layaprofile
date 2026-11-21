# Deployment

LayaProfile is deployed with Docker Compose from **images published to Docker Hub by CI**. The
server never builds the application: it pulls an image that was already linted, tested, built and
smoke-tested, and runs it.

## Architecture

Two containers on one private Compose network:

| Service | Image | Role | Published port |
|---|---|---|---|
| `app` | `<namespace>/layaprofile` | Next.js standalone server (UI and `/api/*`), runs as the non-root `node` user | `APP_PORT` (default 3000) |
| `laya` | `<namespace>/layaprofile-laya` | The official `laya-serve` HTTP server (Python, PyTorch), runs as a non-root user | none |

- **Why a sidecar.** Laya is a Python and PyTorch runtime. Running it in the app container would put
  PyTorch into the Next.js image and tie the web server's memory and restarts to model loading. A
  separate container keeps the app image small, lets Laya be absent or restarted without touching
  the app, and exposes a small interface: `POST /v1/systemone/batch` and `GET /health` (see
  `docs/LAYA.md`).
- **The app works without Laya.** An unreachable or disabled Laya only removes the model
  assessment; the deterministic analysis, scores and comparison keep working. `depends_on` uses
  `condition: service_started` (not healthy) and `required: false`, so the app starts at once while
  the model is still downloading or loading, and also starts when the Laya container is not part of
  the deployment.
- **The model cache is a volume.** Checkpoints are stored in the named volume
  `layaprofile_laya-hf-cache`, mounted at the image's `HF_HOME` (`/home/laya/.cache/huggingface`).
  Neither image contains model weights. The volume survives restarts and image upgrades.
  `docker compose down -v` deletes it and forces a new download.
- **Hardening.** Both containers run as non-root users, drop all Linux capabilities, set
  `no-new-privileges`, run with `init: true` (a real init process forwards signals and reaps
  zombies), and have rotated JSON logs.
- **Health.** The app image has a `HEALTHCHECK` that calls `/api/health` with Node's built-in
  `fetch` (the image has no curl). `/api/health` reports the liveness of the app only; Laya's state
  appears under `laya` and never makes the app unhealthy. It exposes no secrets. The Laya image
  checks `/health` of `laya-serve`.

## Requirements

- Docker Engine with Docker Compose v2.20 or newer (`docker compose version`). Older versions do
  not understand `depends_on.<service>.required`.
- Access to Docker Hub (to pull the images) and, for the first start only, to the Hugging Face Hub
  (to download the Laya checkpoints).

## First deployment

```sh
git clone https://github.com/Liwyd/layaprofile.git && cd layaprofile   # or copy docker-compose.yml, .env.example and scripts/deploy.sh
cp .env.example .env
$EDITOR .env          # set DOCKERHUB_NAMESPACE; see below for the rest
scripts/deploy.sh     # pull, start, wait for health
```

Minimum `.env`: `DOCKERHUB_NAMESPACE` (the Docker Hub account CI publishes to). Recommended:

- `GITHUB_TOKEN`: raises the GitHub API limit from 60 to 5000 requests/hour for the whole server
  (no scopes are needed for public data).
- `LAYA_API_KEY`: generate with `openssl rand -hex 32`. The same value is given to both containers.
- `TRUST_PROXY=1` and `APP_BIND=127.0.0.1` only when a reverse proxy on the same host sets
  `X-Forwarded-For` (otherwise anyone could forge that header and bypass the rate limit).

`.env.example` documents every variable. Do not put `DOCKERHUB_TOKEN` in `.env`: the whole file is
passed to the app container.

### Model download and offline operation

The first start of `laya` downloads the English checkpoint from the Hugging Face Hub into the
volume. This can take minutes depending on the connection. Meanwhile:

- the app is already usable and shows the deterministic analysis;
- the Laya container reports `starting` (its health check has a 10 minute start period) and the
  analysis pages show the model assessment as unavailable until it is ready;
- `docker compose logs -f laya` shows the progress.

After the first successful start the weights are cached. To run without any network access to the
Hub, set `HF_HUB_OFFLINE=1` in `.env` and run `docker compose up -d` again. Keep it at `0` (the
default) until the first successful start: with an empty cache, offline mode fails because there is
nothing to load. To also load the multilingual checkpoint (for non-Latin READMEs, for example
Persian), set `LAYA_MODELS=english,multilingual` and start once while online so it is downloaded.

## Running without Laya

Laya is a Compose profile named `laya`. `.env.example` enables it with `COMPOSE_PROFILES=laya`, so a
normal setup starts both containers. To run the app alone:

1. Remove or empty `COMPOSE_PROFILES` in `.env`.
2. Set `LAYA_URL=` (empty) in `.env`, so the app reports Laya as disabled instead of unreachable.
3. `docker compose up -d --remove-orphans` (or `scripts/deploy.sh`).

To start Laya for one command without editing `.env`: `docker compose --profile laya up -d`.

Compose has no way to switch a default service off, so Laya is a profile switched on in `.env`
rather than a service that is always on. One line in `.env` turns it on or off, and the app does not
care which.

## Resource expectations

**Not measured yet.** No memory, CPU, cold-start or latency figure for Laya has been measured in this
project, so none is claimed here. The limits in `docker-compose.yml` are provisional ceilings, not
measurements:

| Service | `mem_limit` | `cpus` |
|---|---|---|
| `app` | 512m | 1.0 |
| `laya` | 3g | 2.0 |

`LAYA_THREADS` (default 2) should not exceed the physical cores available. When the figures have
been measured they will be recorded in `docs/LAYA.md` and the limits revisited. A `laya` container
that exits with code 137 and `OOMKilled=true` (`docker inspect -f '{{.State.OOMKilled}}' <id>`) hit
its memory limit: raise `mem_limit` or load only the `english` checkpoint.

## Local builds

The compose file never builds. To build both images from a checkout, add the override file:

```sh
DOCKERHUB_NAMESPACE=local docker compose -f docker-compose.yml -f docker-compose.build.yml up --build
```

Use a namespace that cannot be confused with the published one (`local` here). The images get the
names from `docker-compose.yml`, so run `docker compose pull` (or `scripts/deploy.sh`) afterwards to
return to the published images. `NEXT_PUBLIC_SITE_URL` is read from the environment or `.env` and
is baked in at build time (see below).

To check the images without Compose:

```sh
docker build -t layaprofile .
docker build -t layaprofile-laya laya
```

## CI and image tags

`.github/workflows/ci.yml` runs on every push (all branches and `v*` tags), pull request and manual
run:

1. **verify**: `npm ci`, `npm run lint`, `npx prettier --check .`, `npm test`, `npm run build`.
2. **docker** (only if verify passed; one job per image): builds the image. The app image is first
   started and probed (health status, non-root user, home page, one static script) before anything
   is pushed. Pushes and manual runs then log in to Docker Hub and push; pull requests only build.

Published tags (both images get the same tags from the same commit):

| Tag | Produced by | Use |
|---|---|---|
| `latest` | a push to the default branch only | follow the main line |
| `sha-<7 characters>` | every push and manual run | exact commit; use for rollbacks |
| `1.2.3` and `1.2` | a `v1.2.3` tag | releases |
| `<branch>` (sanitized) | a push to a branch | testing a branch |

`latest` is written only from the default branch (never from a release tag), and publishing jobs use
a per-image, per-ref concurrency group that is never cancelled, so two runs cannot race to move
`latest`. Release: `git tag v1.0.0 && git push origin v1.0.0`.

Repository settings (Settings, Secrets and variables, Actions):

| Name | Kind | Purpose |
|---|---|---|
| `DOCKERHUB_USERNAME` | secret, required | Docker Hub login; also the default namespace |
| `DOCKERHUB_TOKEN` | secret, required | Docker Hub access token with write access; never printed |
| `DOCKERHUB_NAMESPACE` | variable, optional | namespace for the image names when it differs from the username. GitHub masks secret values in logs, so a variable also keeps the image names readable there |
| `NEXT_PUBLIC_SITE_URL` | variable, optional | public site URL for the absolute Open Graph image address |

`NEXT_PUBLIC_SITE_URL` is inlined into the client bundle **when the app image is built**. Setting it
at run time has no effect; a different address needs a different build.

**GitHub Actions billing must be enabled** for the account or organization that owns the repository.
CI runs on GitHub-hosted runners: when billing is not enabled or the spending limit is reached, jobs
do not start (the run shows a billing annotation), so nothing is verified and no image is published.
The server then has nothing new to pull.

## The deploy script

`scripts/deploy.sh` is the supported way to deploy or update. It runs `docker compose pull` and
`docker compose up -d --no-build --remove-orphans`, then waits (default 120 seconds,
`HEALTH_TIMEOUT=<seconds>` to change it) until the app container reports `healthy`.

- On success it prints `OK: the app is healthy ...`, followed by the Laya status. Laya is not waited
  for: while it downloads or loads the model it stays `starting` and the app works without it.
- On failure it prints the last 50 log lines of the app container and exits with status 1.
- If `DOCKERHUB_TOKEN` (and `DOCKERHUB_USERNAME`) are in the shell environment it runs
  `docker login --password-stdin` first, which private repositories need. The token is never
  printed or written to a file.
- It never builds.

Updating is the same command: it pulls the newest `LAYAPROFILE_TAG` (default `latest`) and recreates
only the containers whose image changed; the model volume is kept.

## Rollback

Every push publishes an immutable-by-convention `sha-<7>` tag. To return to an earlier version, pin
the tag and deploy:

```sh
LAYAPROFILE_TAG=sha-1a2b3c4 scripts/deploy.sh
```

Find the tag from `git rev-parse --short=7 <commit>` or from the tag list on Docker Hub. To make the
pin permanent, put `LAYAPROFILE_TAG=sha-1a2b3c4` in `.env`; remove it to follow `latest` again. A
release tag such as `LAYAPROFILE_TAG=1.2.3` works the same way. The model volume is unaffected.

## GPU (optional, not the default)

CI publishes CPU images only, and GPU execution has not been tested in this project. For an NVIDIA
GPU you need the NVIDIA driver and the NVIDIA Container Toolkit on the host.

1. Build the Laya image against a CUDA PyTorch index. The index must carry the pinned torch version:
   `cu126` does (checked against the PyTorch wheel index); `cu124` has no torch wheels there.

   ```sh
   TORCH_INDEX=cu126 DOCKERHUB_NAMESPACE=local docker compose \
     -f docker-compose.yml -f docker-compose.build.yml build laya
   ```

2. Add `LAYA_DEVICE=cuda` to `.env`.
3. Reserve the GPU for the container, for example in `docker-compose.gpu.yml`:

   ```yaml
   services:
     laya:
       deploy:
         resources:
           reservations:
             devices:
               - driver: nvidia
                 count: 1
                 capabilities: [gpu]
   ```

   and select it with `COMPOSE_FILE=docker-compose.yml:docker-compose.gpu.yml` in `.env`.

`GET /health` of the Laya server (passed on as `laya.detail.device` by `/api/health`) reports where a
checkpoint really computes; Laya falls back to CPU if the GPU is not available.

## Troubleshooting

| Symptom | Cause and fix |
|---|---|
| `required variable DOCKERHUB_NAMESPACE is missing a value` | Set `DOCKERHUB_NAMESPACE` in `.env`. |
| `env file ... .env not found` | `cp .env.example .env`. `docker-compose.yml` requires it. |
| A validation error about `depends_on` and the property `required` | Docker Compose is older than v2.20. Upgrade the Compose plugin. |
| `pull access denied` or `manifest unknown` | The image does not exist under that namespace and tag. Check CI published it (see the Actions run and the billing note above), check `DOCKERHUB_NAMESPACE` and `LAYAPROFILE_TAG`, and for a private repository export `DOCKERHUB_USERNAME` and `DOCKERHUB_TOKEN` before `scripts/deploy.sh`. |
| `scripts/deploy.sh` reports the app is not healthy | Read the printed log lines. Common causes: the host port is taken (change `APP_PORT`), a typo in `.env`, or a too small memory limit. `docker compose ps` shows the state. |
| Analysis pages say the model assessment is unavailable | `curl localhost:3000/api/health` and read `laya.status`. `disabled`: `LAYA_URL` is empty. `unavailable`: look at `docker compose ps` and `docker compose logs laya`. The first start downloads the model, so wait for it. A `LAYA_API_KEY` that differs between the containers shows as an authentication error. |
| `laya` restarts or shows exit code 137 | Out of memory (see Resource expectations). Raise `mem_limit` or use only the `english` checkpoint. |
| `laya` fails at startup with `HF_HUB_OFFLINE=1` | The volume has no cached checkpoint. Set it to `0`, start once online, then set it to `1` again. |
| The model downloads again after an update | The volume was removed (`docker compose down -v`) or the project name changed. The volume is `layaprofile_laya-hf-cache`. |
| GitHub rate limit errors in the UI | Set `GITHUB_TOKEN` in `.env` and run `docker compose up -d`. |
| CI never starts, or stops at the first step with a billing message | GitHub Actions billing is not enabled for the owner of the repository. |
| CI fails at "Require Docker Hub credentials" | The `DOCKERHUB_USERNAME` or `DOCKERHUB_TOKEN` repository secret is missing (this check only runs for pushes). |
| The Open Graph image URL is relative | `NEXT_PUBLIC_SITE_URL` was empty when the app image was built. Set the repository variable and publish a new image. |
