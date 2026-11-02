#!/usr/bin/env bash
# Restores a database backup made by backup.sh into TARGET_DB (default: PGDATABASE).
# DESTRUCTIVE: existing objects in TARGET_DB are dropped first. Pass CONFIRM=yes to proceed.
#
# Usage: CONFIRM=yes restore.sh /backups/maxr-db-<stamp>.dump.enc
set -euo pipefail
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib.sh
. "$here/lib.sh"
require BACKUP_PASSPHRASE_FILE

file="${1:?usage: restore.sh <backup-file>}"
target="${TARGET_DB:-$PGDATABASE}"

if [ "${CONFIRM:-}" != "yes" ]; then
  echo "refusing to overwrite '$target' without CONFIRM=yes" >&2
  exit 2
fi

if [ -f "$file.sha256" ]; then
  (cd "$(dirname "$file")" && sha256sum --check "$(basename "$file").sha256")
fi

decrypt <"$file" | pg pg_restore -U "$PGUSER" -d "$target" --clean --if-exists --no-owner --exit-on-error
echo "restored $file into $target"
