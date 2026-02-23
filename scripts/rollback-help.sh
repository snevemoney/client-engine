#!/usr/bin/env bash
# Prints rollback commands. Does NOT run them.

echo "# 1) List images: docker images | head -20"
echo "# 2) Rebuild: docker compose build app worker && docker compose up -d app worker"
echo "# 3) Health: curl -s http://127.0.0.1:3200/api/health"
echo "# 4) Logs: docker compose logs -f --tail=100 app worker"
