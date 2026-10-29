# Shared helpers for the backup scripts. Sourced, not executed.
#
# Two ways to reach PostgreSQL:
#   direct  (default): the standard PG* variables (PGHOST, PGPORT, PGUSER, PGPASSWORD) and a PG client on this host.
#   compose: PG_EXEC="docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env.production exec -T postgres"
#            PGUSER and PGDATABASE must still be set; the client runs inside the postgres container.

set -euo pipefail
umask 077

: "${PGUSER:?set PGUSER}"
: "${PGDATABASE:?set PGDATABASE}"
PG_EXEC="${PG_EXEC:-}"

require() {
  for name in "$@"; do
    if [ -z "${!name:-}" ]; then
      echo "error: $name is required" >&2
      exit 2
    fi
  done
}

# Intentionally unquoted so PG_EXEC may hold a multi-word command prefix.
pg() {
  # shellcheck disable=SC2086
  $PG_EXEC "$@"
}

encrypt() {
  openssl enc -aes-256-cbc -pbkdf2 -iter 200000 -salt -pass "file:${BACKUP_PASSPHRASE_FILE}"
}

decrypt() {
  openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 -pass "file:${BACKUP_PASSPHRASE_FILE}"
}
