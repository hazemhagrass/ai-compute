FROM node:24.11.0-bookworm-slim AS base
ENV PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH \
    NEXT_TELEMETRY_DISABLED=1
RUN corepack enable
WORKDIR /app

FROM base AS deps

RUN apt-get update \
 && apt-get install -y --no-install-recommends python3 make g++ ca-certificates \
 && rm -rf /var/lib/apt/lists/*

COPY apps/ai-model-router/package.json \
     apps/ai-model-router/pnpm-lock.yaml \
     apps/ai-model-router/pnpm-workspace.yaml \
     ./

RUN pnpm install --frozen-lockfile

FROM base AS prod-deps
RUN apt-get update \
 && apt-get install -y --no-install-recommends python3 make g++ ca-certificates \
 && rm -rf /var/lib/apt/lists/*

COPY apps/ai-model-router/package.json \
     apps/ai-model-router/pnpm-lock.yaml \
     apps/ai-model-router/pnpm-workspace.yaml \
     ./

RUN pnpm install --frozen-lockfile --prod

RUN node -e "const D=require('better-sqlite3');const d=new D(':memory:');d.exec('create table t(x)');d.prepare('insert into t values (?)').run(1);if(d.prepare('select x from t').get().x!==1)process.exit(1);console.log('better-sqlite3 native binding OK');"

FROM deps AS builder

COPY apps/ai-model-router/ ./

ENV NODE_ENV=production
RUN pnpm run build

FROM node:24.11.0-bookworm-slim AS runner

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

ENV AMR_DATA_DIR=/data \
    AMR_DB_PATH=/data/router.db

WORKDIR /app

COPY --from=prod-deps --chown=node:node /app/node_modules ./node_modules
COPY --from=builder   --chown=node:node /app/.next        ./.next
COPY --from=builder   --chown=node:node /app/public       ./public
COPY --from=builder   --chown=node:node /app/package.json /app/next.config.ts ./

RUN mkdir -p /data && chown -R node:node /data
VOLUME ["/data"]

USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/',{redirect:'manual'}).then(r=>process.exit(r.status<500?0:1)).catch(()=>process.exit(1))"

CMD ["node", "node_modules/next/dist/bin/next", "start"]
