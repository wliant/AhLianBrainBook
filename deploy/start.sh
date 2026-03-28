#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
COMPOSE_FILE="$PROJECT_ROOT/docker-compose.prod.yml"
ENV_FILE="$PROJECT_ROOT/.env"
ENV_EXAMPLE="$PROJECT_ROOT/.env.example"

if [ ! -f "$ENV_FILE" ]; then
  if [ -f "$ENV_EXAMPLE" ]; then
    cp "$ENV_EXAMPLE" "$ENV_FILE"
    echo "Created .env from .env.example — please edit it with your production values, then re-run this script."
    exit 1
  else
    echo "Error: .env file not found and no .env.example to copy from."
    exit 1
  fi
fi

echo "Starting BrainBook production stack..."
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d --build

echo ""
echo "BrainBook is starting up. Services:"
# Source .env to read ports for display
set -a; source "$ENV_FILE"; set +a
echo "  Web: http://localhost:${WEB_PORT:-3000}"
echo "  API: http://localhost:${APP_PORT:-8080}"
echo ""
echo "Run 'docker compose -f $COMPOSE_FILE ps' to check status."
