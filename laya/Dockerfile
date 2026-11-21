# LayaProfile inference sidecar: the official `laya-serve` HTTP server (PyPI `laya[serve]`).
# CPU torch by default; model weights are NOT baked in — they live in the HF cache volume.
#
# Offline operation: the first start downloads the checkpoints into HF_HOME (mount a volume
# there, see docker-compose.yml). Once they are cached, set HF_HUB_OFFLINE=1 at run time to stop
# all Hub network access. It is a runtime variable on purpose: the image never sets it, because
# an offline first start would fail.
ARG PYTHON_IMAGE=python:3.12-slim

FROM ${PYTHON_IMAGE} AS build
ENV PIP_NO_CACHE_DIR=1 PIP_DISABLE_PIP_VERSION_CHECK=1
RUN python -m venv --upgrade-deps /opt/venv
ENV PATH="/opt/venv/bin:$PATH"
# CPU wheels by default. For an NVIDIA GPU build with a CUDA index that carries TORCH_VERSION,
# for example --build-arg TORCH_INDEX=cu126 (checked: cu124 has no torch wheels), and run with
# LAYA_DEVICE=cuda (see docs/DEPLOYMENT.md).
ARG TORCH_INDEX=cpu
ARG TORCH_VERSION=2.14.0
ARG LAYA_VERSION=0.5.0
RUN pip install "torch==${TORCH_VERSION}" --index-url "https://download.pytorch.org/whl/${TORCH_INDEX}" \
 && pip install "laya[serve]==${LAYA_VERSION}" \
 && pip check

FROM ${PYTHON_IMAGE} AS runtime
LABEL org.opencontainers.image.title="layaprofile-laya" \
      org.opencontainers.image.description="Local Laya decision server for LayaProfile" \
      org.opencontainers.image.licenses="Apache-2.0"
ENV PATH="/opt/venv/bin:$PATH" \
    PYTHONUNBUFFERED=1 PYTHONDONTWRITEBYTECODE=1 \
    TORCH_DISABLE_NATIVE_JIT=1 TOKENIZERS_PARALLELISM=false \
    USE_TF=0 USE_TORCH=1 \
    HF_HOME=/home/laya/.cache/huggingface \
    OMP_NUM_THREADS=2 \
    LAYA_HOST=0.0.0.0 LAYA_PORT=8000 LAYA_DEVICE=cpu \
    LAYA_MODELS=english LAYA_DEFAULT_MODEL=english LAYA_PRELOAD=1 \
    LAYA_MAX_LOADED=1 LAYA_THREADS=2 LAYA_IDLE_UNLOAD_SECONDS=0
RUN groupadd --gid 10001 laya \
 && useradd --uid 10001 --gid laya --create-home laya \
 && mkdir -p /home/laya/.cache/huggingface \
 && chown -R laya:laya /home/laya/.cache
COPY --from=build /opt/venv /opt/venv
USER laya
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=300s --retries=3 \
  CMD ["python", "-c", "import os,urllib.request;urllib.request.urlopen('http://127.0.0.1:'+os.environ.get('LAYA_PORT','8000')+'/health',timeout=4)"]
CMD ["laya-serve"]
