#!/usr/bin/env bash
# Restore drill: restores a backup into a throw-away database, checks it, and drops it.
# Exit code 0 means the backup is restorable and contains the application schema.
#
# Usage: verify-restore.sh /backups/maxr-db-<stamp>.dump.enc
set -euo pipefail
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib.sh
. "$here/lib.sh"
require BACKUP_PASSPHRASE_FILE

file="${1:?usage: verify-restore.sh <backup-file>}"
scratch="restore_check_$(date -u +%Y%m%d%H%M%S)_$$"

cleanup() {
  pg psql -U "$PGUSER" -d postgres -v ON_ERROR_STOP=1 -qc "DROP DATABASE IF EXISTS \"$scratch\"" >/dev/null 2>&1 || true
}
trap cleanup EXIT

pg psql -U "$PGUSER" -d postgres -v ON_ERROR_STOP=1 -qc "CREATE DATABASE \"$scratch\""
TARGET_DB="$scratch" CONFIRM=yes "$here/restore.sh" "$file"

tables="$(pg psql -U "$PGUSER" -d "$scratch" -Atqc "SELECT count(*) FROM information_schema.tables WHERE table_schema='public'")"
migrations="$(pg psql -U "$PGUSER" -d "$scratch" -Atqc "SELECT count(*) FROM schema_migrations")"

if [ "$tables" -lt 1 ] || [ "$migrations" -lt 1 ]; then
  echo "FAILED: restored database has $tables tables and $migrations applied migrations" >&2
  exit 1
fi
echo "OK: restore drill passed ($tables tables, $migrations migrations) for $file"
