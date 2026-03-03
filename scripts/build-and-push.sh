#!/usr/bin/env bash
# Build Docker images locally and push to GitHub Container Registry.
# Usage: ./scripts/build-and-push.sh [TAG]
#   TAG defaults to "latest"
#
# Prerequisites (one-time):
#   echo $GITHUB_TOKEN | docker login ghcr.io -u snevemoney --password-stdin

set -euo pipefail

REGISTRY="ghcr.io/snevemoney"
TAG="${1:-latest}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

echo "==> Building app + worker locally (BuildKit)..."
DOCKER_BUILDKIT=1 docker compose build app worker

echo "==> Tagging for GHCR..."
docker tag client-engine-app "$REGISTRY/client-engine-app:$TAG"
docker tag client-engine-worker "$REGISTRY/client-engine-worker:$TAG"

echo "==> Pushing to GHCR..."
docker push "$REGISTRY/client-engine-app:$TAG"
docker push "$REGISTRY/client-engine-worker:$TAG"

echo ""
echo "==> Images pushed. Deploy with:"
echo "    npm run deploy          # fast (pull + restart)"
echo "    npm run deploy:full     # safe (pull + restart + DB sync)"
