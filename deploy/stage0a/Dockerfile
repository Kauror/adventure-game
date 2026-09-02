# syntax=docker/dockerfile:1

# Stage 0A-1 published client.
#
# A Vite build is just static files, so the runtime image is nginx and nothing
# else: no Node, no pnpm, no source, no dev dependencies. Stage 0A has no game
# server, no database and no persistence (ADR 0004), and this image is the whole
# deployment.

# ---------------------------------------------------------------------------
# Builder
# ---------------------------------------------------------------------------
FROM node:24-alpine AS builder

WORKDIR /src

# pnpm is pinned to the version in the root package.json's `packageManager`
# field. Installed directly rather than through corepack, which is deprecated
# and prints a warning on every build.
RUN npm install --global pnpm@11.24.0

# Manifests first, so a source-only change reuses the dependency layer.
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY packages/game-core/package.json packages/game-core/
COPY packages/content/package.json packages/content/
COPY apps/client/package.json apps/client/
RUN pnpm install --frozen-lockfile

COPY . .

# The build context excludes .git (see .dockerignore), so the commit cannot be
# read here — the deploy script passes it in. Without it the published build is
# untraceable, which defeats the point of the version marker.
ARG BUILD_SHA=unknown
ARG BUILD_TIME=
ENV BUILD_SHA=${BUILD_SHA}
ENV BUILD_TIME=${BUILD_TIME}

RUN pnpm --filter @adventure/client build

# ---------------------------------------------------------------------------
# Runtime
# ---------------------------------------------------------------------------
# The unprivileged image runs as uid 101 and listens on 8080, so the container
# needs no root and no NET_BIND_SERVICE. Public TLS is Cloudflare's job; this
# serves plain HTTP to the tunnel only.
FROM nginxinc/nginx-unprivileged:1.29-alpine AS runtime

COPY deploy/stage0a/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /src/apps/client/dist /usr/share/nginx/html

EXPOSE 8080
