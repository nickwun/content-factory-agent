#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="${CONTENT_FACTORY_ROOT_DIR:-/opt/content-factory}"
DATA_DIR="${CONTENT_FACTORY_DATA_DIR:-$ROOT_DIR/data}"
UPLOADS_DIR="${CONTENT_FACTORY_UPLOADS_DIR:-$ROOT_DIR/uploads}"
ENV_FILE="${CONTENT_FACTORY_ENV_FILE:-$ROOT_DIR/.env}"
BACKUP_DIR="${CONTENT_FACTORY_BACKUP_DIR:-$ROOT_DIR/backups}"
KEEP_COUNT="${BACKUP_KEEP_COUNT:-7}"

TIMESTAMP="$(date '+%Y%m%d-%H%M%S')"
ARCHIVE_PATH="$BACKUP_DIR/content-factory-$TIMESTAMP.tar.gz"

mkdir -p "$BACKUP_DIR"

declare -a INCLUDE_PATHS=()

if [[ -d "$DATA_DIR" ]]; then
  INCLUDE_PATHS+=("data")
fi

if [[ -d "$UPLOADS_DIR" ]]; then
  INCLUDE_PATHS+=("uploads")
fi

if [[ -f "$ENV_FILE" ]]; then
  INCLUDE_PATHS+=(".env")
fi

if [[ ${#INCLUDE_PATHS[@]} -eq 0 ]]; then
  echo "Nothing to back up from $ROOT_DIR"
  exit 1
fi

(
  cd "$ROOT_DIR"
  tar -czf "$ARCHIVE_PATH" "${INCLUDE_PATHS[@]}"
)

mapfile -t EXISTING_BACKUPS < <(find "$BACKUP_DIR" -maxdepth 1 -type f -name 'content-factory-*.tar.gz' | sort -r)

if [[ "${#EXISTING_BACKUPS[@]}" -gt "$KEEP_COUNT" ]]; then
  for OLD_BACKUP in "${EXISTING_BACKUPS[@]:$KEEP_COUNT}"; do
    rm -f "$OLD_BACKUP"
  done
fi

echo "Backup created: $ARCHIVE_PATH"
