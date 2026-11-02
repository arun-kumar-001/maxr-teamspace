#!/usr/bin/env bash
# Encrypted PostgreSQL backup (+ optional uploads archive) with retention.
#
# Required: BACKUP_DIR, BACKUP_PASSPHRASE_FILE (a file holding the encryption passphrase, mode 600),
#           PGUSER, PGDATABASE. Optional: BACKUP_RETENTION_DAYS (default 35), UPLOADS_DIR.
# Keep the passphrase somewhere other than the backup location; without it a backup cannot be restored.
set -euo pipefail
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib.sh
. "$here/lib.sh"
require BACKUP_DIR BACKUP_PASSPHRASE_FILE

retention="${BACKUP_RETENTION_DAYS:-35}"
stamp="$(date -u +%Y%m%dT%H%M%SZ)"
mkdir -p "$BACKUP_DIR"

db_file="$BACKUP_DIR/maxr-db-$stamp.dump.enc"
pg pg_dump -U "$PGUSER" -d "$PGDATABASE" --format=custom --no-owner | encrypt >"$db_file.partial"
mv "$db_file.partial" "$db_file"
(cd "$BACKUP_DIR" && sha256sum "$(basename "$db_file")" >"$(basename "$db_file").sha256")
echo "database backup: $db_file"

if [ -n "${UPLOADS_DIR:-}" ]; then
  up_file="$BACKUP_DIR/maxr-uploads-$stamp.tar.gz.enc"
  tar -C "$UPLOADS_DIR" -czf - . | encrypt >"$up_file.partial"
  mv "$up_file.partial" "$up_file"
  (cd "$BACKUP_DIR" && sha256sum "$(basename "$up_file")" >"$(basename "$up_file").sha256")
  echo "uploads backup:  $up_file"
fi

find "$BACKUP_DIR" -maxdepth 1 -type f \( -name 'maxr-db-*' -o -name 'maxr-uploads-*' \) -mtime "+$retention" -delete
