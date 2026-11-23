#!/usr/bin/env bash
# Deploys one exact commit to the Cantobo host over SSH by running deploy/server-deploy.sh there,
# then waits for the API to report healthy. Called by .github/workflows/deploy.yml.
#
# Required (GitHub environment secrets):
#   CANTOBO_HOST         host name or IP of the server
#   CANTOBO_SSH_KEY      private key of the deploy user (PEM/OpenSSH text)
#   CANTOBO_KNOWN_HOSTS  the server's host key line(s), e.g. the output of `ssh-keyscan -t ed25519 HOST`
#                        taken once and checked by a person. The connection fails if the key differs.
# Required input:
#   DEPLOY_REF           the full 40-character commit SHA to deploy
# Optional:
#   CANTOBO_USER         SSH user (default: deploy)
#   APP_DIR              repository checkout on the server (default: /opt/maxr-teamspace)
#   DRY_RUN              "true" checks the inputs and stops before connecting
#
# It never reports success without having deployed: missing secrets are an error, unless DRY_RUN is
# true, in which case it says plainly that nothing was deployed.
set -euo pipefail

DRY_RUN="${DRY_RUN:-false}"
CANTOBO_USER="${CANTOBO_USER:-deploy}"
APP_DIR="${APP_DIR:-/opt/maxr-teamspace}"

fail() {
  echo "::error::$*" >&2
  exit 1
}

# Everything below ends up inside a remote shell command, so each value is checked first.
[[ "${DEPLOY_REF:-}" =~ ^[0-9a-f]{40}$ ]] || fail "DEPLOY_REF must be a full 40-character commit SHA."
[[ "$CANTOBO_USER" =~ ^[a-z_][a-z0-9_-]{0,31}$ ]] || fail "CANTOBO_USER is not a valid user name."
[[ "$APP_DIR" =~ ^/[A-Za-z0-9._/-]+$ ]] || fail "APP_DIR must be an absolute path without spaces or shell characters."

missing=()
for name in CANTOBO_HOST CANTOBO_SSH_KEY CANTOBO_KNOWN_HOSTS; do
  [ -n "${!name:-}" ] || missing+=("$name")
done

if [ "${#missing[@]}" -gt 0 ]; then
  if [ "$DRY_RUN" = "true" ]; then
    echo "DRY RUN: would deploy ${DEPLOY_REF} to ${CANTOBO_USER}@<host>:${APP_DIR}."
    echo "DRY RUN: secrets not set (${missing[*]}). NOTHING WAS DEPLOYED."
    exit 0
  fi
  fail "Deployment secrets not set: ${missing[*]}. Nothing was deployed."
fi

[[ "$CANTOBO_HOST" =~ ^[A-Za-z0-9.-]+$ ]] || fail "CANTOBO_HOST is not a valid host name."

if [ "$DRY_RUN" = "true" ]; then
  echo "DRY RUN: would deploy ${DEPLOY_REF} to ${CANTOBO_USER}@${CANTOBO_HOST}:${APP_DIR}. NOTHING WAS DEPLOYED."
  exit 0
fi

work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
umask 077
printf '%s\n' "$CANTOBO_SSH_KEY" >"$work/key"
printf '%s\n' "$CANTOBO_KNOWN_HOSTS" >"$work/known_hosts"
chmod 600 "$work/key" "$work/known_hosts"

echo "Deploying ${DEPLOY_REF} to ${CANTOBO_USER}@${CANTOBO_HOST}:${APP_DIR}"

# The remote script reads its arguments, never values spliced into the command line.
ssh -i "$work/key" \
  -o BatchMode=yes \
  -o IdentitiesOnly=yes \
  -o StrictHostKeyChecking=yes \
  -o UserKnownHostsFile="$work/known_hosts" \
  -o ConnectTimeout=20 \
  "${CANTOBO_USER}@${CANTOBO_HOST}" \
  bash -s -- "$APP_DIR" "$DEPLOY_REF" <<'REMOTE'
set -euo pipefail
app_dir="$1"
ref="$2"

cd "$app_dir"
git fetch --tags --prune origin
git checkout --detach "$ref"
./deploy/server-deploy.sh

port="$(grep -E '^HTTPS_PORT=' deploy/.env.production | cut -d= -f2- | tr -d '"' || true)"
port="${port:-443}"
echo "Waiting for the API to report healthy on port ${port}..."
for _ in $(seq 1 30); do
  if curl -fsSk "https://127.0.0.1:${port}/api/v1/health" >/dev/null 2>&1; then
    echo "Deployment of ${ref} is healthy."
    exit 0
  fi
  sleep 10
done

echo "The API did not become healthy within 5 minutes. Recent API log:" >&2
docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env.production logs --tail 50 api >&2 || true
exit 1
REMOTE
