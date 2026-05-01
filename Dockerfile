# syntax=docker/dockerfile:1.7
# ---------------------------------------------------------------------------
# ArgoUI — multi-stage container build
# ---------------------------------------------------------------------------
# Build stage: pull deps, compile renderer + server bundle.
# Runtime stage: copy only what we need to run dist-server/server.mjs.
# Base: debian-slim (glibc) — better-sqlite3 native module wants glibc;
# alpine/musl rebuilds are painful and not worth it for a 100MB savings.
# ---------------------------------------------------------------------------

ARG BUN_VERSION=1.3.13

# ─── Build stage ────────────────────────────────────────────────────────────
FROM oven/bun:${BUN_VERSION}-debian AS build

# Build-time deps: node-gyp toolchain for better-sqlite3, python for build scripts.
RUN apt-get update \
 && apt-get install -y --no-install-recommends \
        build-essential \
        python3 \
        ca-certificates \
        git \
        node-gyp \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy lockfiles first to maximize layer cache hits.
COPY package.json bun.lock* bun.lockb* ./
COPY patches/ ./patches/

# Install ALL deps (dev included — needed for vite build of renderer).
RUN bun install --frozen-lockfile || bun install

# Copy the rest of the source.
COPY . .

# Build the web renderer (served as static assets by the standalone server)
# and the server bundle.
RUN bun run build:renderer:web \
 && bun run build:server

# Prune to production deps so the runtime stage only carries what the server needs.
# dist-server/server.mjs is a self-contained esbuild bundle, but better-sqlite3
# and a few external packages are loaded from node_modules at runtime.
RUN rm -rf node_modules \
 && bun install --frozen-lockfile --production \
 && bun pm cache rm 2>/dev/null || true

# ─── Runtime stage ──────────────────────────────────────────────────────────
FROM oven/bun:${BUN_VERSION}-debian AS runtime

# Runtime deps: ca-certificates for HTTPS leaves, tini for proper PID-1 signal
# handling, libstdc++ for native modules.
RUN apt-get update \
 && apt-get install -y --no-install-recommends \
        ca-certificates \
        tini \
        libstdc++6 \
 && rm -rf /var/lib/apt/lists/*

# Non-root user. UID/GID 10001 sits well outside common host UID space so bind
# mounts won't accidentally collide with a real user account on the host.
ARG ARGOUI_UID=10001
ARG ARGOUI_GID=10001
RUN groupadd --system --gid ${ARGOUI_GID} argo \
 && useradd  --system --uid ${ARGOUI_UID} --gid ${ARGOUI_GID} \
             --home-dir /home/argo --create-home --shell /usr/sbin/nologin argo

WORKDIR /app

# Copy build artifacts and pruned production deps from the build stage.
COPY --from=build --chown=argo:argo /app/dist-server      ./dist-server
COPY --from=build --chown=argo:argo /app/out/renderer     ./out/renderer
COPY --from=build --chown=argo:argo /app/node_modules     ./node_modules
COPY --from=build --chown=argo:argo /app/package.json     ./package.json
COPY --from=build --chown=argo:argo /app/resources/hub    ./resources/hub
COPY --from=build --chown=argo:argo /app/src/process/resources \
                                                          ./src/process/resources

# Persistent state lives under the user's home so a single named volume
# captures everything — SQLite DB, config, builtin-skills cache.
RUN mkdir -p /home/argo/.config/ArgoUI \
 && chown -R argo:argo /home/argo

USER argo

ENV NODE_ENV=production \
    PORT=3000 \
    XDG_CONFIG_HOME=/home/argo/.config

EXPOSE 3000

# Healthcheck — the server returns 200 on root once the renderer is up.
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
    CMD bun -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# tini reaps zombies and forwards SIGTERM/SIGINT correctly to bun.
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["bun", "dist-server/server.mjs"]
