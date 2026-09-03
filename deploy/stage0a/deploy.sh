#!/bin/sh
# Build and (re)start the Stage 0A-1 static client.
#
# Run from the repository root, on the machine that has Docker — that is KOCorp,
# where the source is unpacked under /mnt/user/appdata/adventure/src.
#
#   ./deploy/stage0a/deploy.sh [<commit-sha>]
#
# The SHA is what makes the published build traceable: it becomes the image tag
# and the version marker the phone reports. It is read from git when git is
# available, and must be passed explicitly otherwise, because the deployed
# source copy has no .git directory.

set -eu

SHA="${1:-${BUILD_SHA:-}}"

if [ -z "$SHA" ]; then
  if git rev-parse --short=12 HEAD >/dev/null 2>&1; then
    SHA="$(git rev-parse --short=12 HEAD)"
  else
    echo "error: no commit SHA. Pass it as the first argument." >&2
    echo "  a published build that cannot be traced to a commit is not deployable" >&2
    exit 1
  fi
fi

BUILD_TIME="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
IMAGE="adventure-web:${SHA}"
COMPOSE="deploy/stage0a/docker-compose.yml"

echo "building ${IMAGE} (built at ${BUILD_TIME})"

docker build \
  --file deploy/stage0a/Dockerfile \
  --tag "${IMAGE}" \
  --build-arg "BUILD_SHA=${SHA}" \
  --build-arg "BUILD_TIME=${BUILD_TIME}" \
  .

# Exported rather than prefixed onto one command: every `docker compose` call
# below interpolates the compose file, and the `ps` at the end failed on the
# first real deploy because it could not see the variable.
export ADVENTURE_IMAGE="${IMAGE}"

# `up -d` recreates only this service. It touches nothing else on the host:
# no other container, no global Docker state, no unrelated network.
docker compose --file "${COMPOSE}" up -d

echo
echo "deployed ${IMAGE}"
docker compose --file "${COMPOSE}" ps
