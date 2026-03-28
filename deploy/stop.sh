#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
COMPOSE_FILE="$PROJECT_ROOT/docker-compose.prod.yml"
ENV_FILE="$PROJECT_ROOT/.env"

if [ ! -f "$ENV_FILE" ]; then
  echo "Error: .env file not found. Nothing to stop."
  exit 1
fi

if [ "${1:-}" = "--volumes" ]; then
  echo "Stopping BrainBook and removing volumes (all data will be deleted)..."
  docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" down -v
else
  echo "Stopping BrainBook..."
  docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" down
  echo ""
  echo "Data volumes preserved. Use '--volumes' flag to also delete data."
fi
