# ai-model-router: Next.js 16 (App Router) + better-sqlite3.
#
# Build from the REPO ROOT:   docker build -t amr .
#
# Layout note: this repo keeps its pnpm root inside the app directory
# (apps/ai-model-router holds package.json, pnpm-lock.yaml and
# pnpm-workspace.yaml), so every pnpm command below runs with WORKDIR
# /app mapped to apps/ai-model-router.
#
# Stages:
#   base      pinned node runtime, corepack/pnpm enabled
#   deps      full install (dev deps included) for the build
#   prod-deps separate production-only install for the runtime image
#   builder   next build
#   runner    minimal, non-root, no compilers, no dev deps

# Debian slim, not Alpine: better-sqlite3 is compiled from source here and a
# glibc build matches the prebuilt binaries and toolchain the package expects.
# The tag is pinned so a rebuild cannot silently change the Node ABI, which
# would make the compiled better-sqlite3 binding refuse to load.
FROM node:24.11.0-bookworm-slim AS base
ENV PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH \
    NEXT_TELEMETRY_DISABLED=1
RUN corepack enable
WORKDIR /app


# ---------------------------------------------------------------------------
# Stage 1: dependencies (dev + prod) used only to build.
# ---------------------------------------------------------------------------
FROM base AS deps

# better-sqlite3 is a NATIVE module. When no prebuilt binary matches this
# platform/Node ABI it falls back to node-gyp, which needs python3, make and a
# C++ compiler. Without them the install fails, or worse it appears to succeed
# and the app dies at runtime with "Could not locate the bindings file".
# These packages exist in the build stages ONLY and never reach the final image.
RUN apt-get update \
 && apt-get install -y --no-install-recommends python3 make g++ ca-certificates \
 && rm -rf /var/lib/apt/lists/*

# Manifests FIRST, source later. This layer only invalidates when the lockfile
# or package.json changes, so editing a component does not reinstall or
# recompile anything. pnpm-workspace.yaml matters too: it carries the
# built-dependency policy pnpm consults during install.
COPY apps/ai-model-router/package.json \
     apps/ai-model-router/pnpm-lock.yaml \
     apps/ai-model-router/pnpm-workspace.yaml \
     ./

# --frozen-lockfile: fail loudly if the lockfile and package.json disagree
# instead of quietly resolving different versions than CI tested.
# No BuildKit cache mount here: this Dockerfile stays buildable with the legacy
# builder too, and the manifest-first COPY above already gives layer caching.
RUN pnpm install --frozen-lockfile


# ---------------------------------------------------------------------------
# Stage 2: production-only dependencies for the runtime image.
# ---------------------------------------------------------------------------
# Installed separately rather than pruned from stage 1, because pruning a pnpm
# store is unreliable and would risk deleting the compiled .node binding.
# This stage still needs the compiler: better-sqlite3 is a PROD dependency, so
# its native binding is rebuilt here for the exact same Node version and libc
# as the runner, and only the finished node_modules tree is carried forward.
FROM base AS prod-deps
RUN apt-get update \
 && apt-get install -y --no-install-recommends python3 make g++ ca-certificates \
 && rm -rf /var/lib/apt/lists/*

COPY apps/ai-model-router/package.json \
     apps/ai-model-router/pnpm-lock.yaml \
     apps/ai-model-router/pnpm-workspace.yaml \
     ./

RUN pnpm install --frozen-lockfile --prod

# Fail the BUILD, not the first request, if the native binding did not compile.
# better-sqlite3 resolves its binding lazily, so an unverified image can start
# cleanly and only break when someone saves a provider key.
RUN node -e "const D=require('better-sqlite3');const d=new D(':memory:');d.exec('create table t(x)');d.prepare('insert into t values (?)').run(1);if(d.prepare('select x from t').get().x!==1)process.exit(1);console.log('better-sqlite3 native binding OK');"


# ---------------------------------------------------------------------------
# Stage 3: build the Next.js app.
# ---------------------------------------------------------------------------
FROM deps AS builder

COPY apps/ai-model-router/ ./

ENV NODE_ENV=production
RUN pnpm run build


# ---------------------------------------------------------------------------
# Stage 4: runtime. No compilers, no dev dependencies, no source tree.
# ---------------------------------------------------------------------------
FROM node:24.11.0-bookworm-slim AS runner

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

# Where paths.ts looks for the SQLite file and the encryption master key.
# Confirmed in src/lib/paths.ts: AMR_DATA_DIR (default <cwd>/data) and
# AMR_DB_PATH (default <AMR_DATA_DIR>/router.db). src/lib/crypto.ts writes the
# auto-generated master key to <AMR_DATA_DIR>/.secret, so both live on the same
# volume mount point declared below and in docker-compose.yml.
ENV AMR_DATA_DIR=/data \
    AMR_DB_PATH=/data/router.db

WORKDIR /app

# next.config.ts does NOT set `output: "standalone"` (it is an empty config), so
# there is no .next/standalone directory to copy and no self-contained server.js.
# Instead we run `next start` and copy exactly what it needs at runtime:
# production node_modules, the .next build output, public assets, package.json
# and next.config.ts. Nothing else from the source tree ships.
# If standalone output is enabled later, replace the three COPY lines below with
# the .next/standalone + .next/static + public copies and run `node server.js`.

# The stock node image already has a non-root `node` user (uid/gid 1000).
# --chown on every COPY avoids a root-owned tree that the app cannot read.
COPY --from=prod-deps --chown=node:node /app/node_modules ./node_modules
COPY --from=builder   --chown=node:node /app/.next        ./.next
COPY --from=builder   --chown=node:node /app/public       ./public
COPY --from=builder   --chown=node:node /app/package.json /app/next.config.ts ./

# The data directory must exist AND be owned by the runtime user before the
# volume is mounted: Docker seeds a fresh named volume from the image's
# directory, ownership included. Skip this and the container starts fine, then
# dies the first time it writes router.db or data/.secret with EACCES, which is
# the classic "container boots then crashes on first write" failure.
RUN mkdir -p /data && chown -R node:node /data
VOLUME ["/data"]

USER node

EXPOSE 3000

# Verify the app actually SERVES, not merely that a pid exists. A Next.js
# process can stay alive while the server is wedged. Any HTTP status below 500
# counts as healthy because "/" may legitimately redirect to the login page.
# Uses node's built-in fetch, so no curl or wget is needed in the image.
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/',{redirect:'manual'}).then(r=>process.exit(r.status<500?0:1)).catch(()=>process.exit(1))"

# npx-free, pnpm-free start: call the next binary directly so PID 1 is node and
# receives SIGTERM, letting SQLite close its WAL cleanly on `docker stop`.
CMD ["node", "node_modules/next/dist/bin/next", "start"]
