# LayaProfile app image: the Next.js standalone server.
#
# Three stages. Only the last one ships: it holds the traced production files, never
# devDependencies, sources, git history or build caches. The Laya inference sidecar has its own
# image (laya/Dockerfile); model weights never go into either image.
ARG NODE_IMAGE=node:22-alpine

# Dependencies. Cached until package.json or the lockfile change.
FROM ${NODE_IMAGE} AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

# Production build (`output: 'standalone'` in next.config.js).
FROM ${NODE_IMAGE} AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
# components/Head.js reads NEXT_PUBLIC_SITE_URL while building (absolute Open Graph image URL).
# It is inlined into the client bundle, so it is a build argument, not a runtime variable, and
# must never hold a secret. Empty keeps the image address relative.
ARG NEXT_PUBLIC_SITE_URL=""
ENV NEXT_PUBLIC_SITE_URL=${NEXT_PUBLIC_SITE_URL}
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# Runtime. Next copies only the traced server files into .next/standalone; it does not copy
# .next/static or public, so both are added separately.
FROM ${NODE_IMAGE} AS runtime
LABEL org.opencontainers.image.title="layaprofile" \
      org.opencontainers.image.description="LayaProfile: local intelligence for GitHub profiles and repositories." \
      org.opencontainers.image.licenses="MIT"
# HOSTNAME must be set here: standalone server.js binds to it and Docker would otherwise
# supply the container ID.
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
WORKDIR /app
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public
# Keeps the MIT notice (including the original OctoProfile copyright) with the image.
COPY --from=build /app/LICENSE ./LICENSE
USER node
EXPOSE 3000
# The image has no curl or wget; node's built-in fetch does the probe. /api/health reports the
# liveness of this app only: an unavailable Laya server never makes it fail.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health',{signal:AbortSignal.timeout(4000)}).then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]
# Next's server handles SIGTERM itself and exits. Compose adds `init: true` so signals and
# zombie processes are handled by a real init as well.
CMD ["node", "server.js"]
