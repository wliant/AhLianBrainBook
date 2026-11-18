#!/usr/bin/env bash
# Create the backing resources an environment needs on the target host: its
# application database, its sandbox database and role, and its object-storage
# bucket.
#
# Idempotent - safe to re-run. It only ever creates what is missing and never
# touches an existing database or bucket, so running it against prod cannot
# disturb live data.
#
# Postgres and MinIO are provided infrastructure outside the application
# stack; this is the one script that reaches into them.
#
# Usage: scripts/provision.sh <dev|prod>

source "$(dirname "$0")/lib/common.sh"
require_command ssh python3

[[ $# -eq 1 ]] || die "usage: $(basename "$0") <dev|prod>"
load_env "$1"
require_env SSH_USER DEPLOY_HOST SPRING_DATASOURCE_URL SPRING_DATASOURCE_USERNAME \
    SANDBOX_DATABASE_URL MINIO_BUCKET

# Container names of the provided infrastructure on the target host. The app
# database needs pgvector for the embeddings; the sandbox database does not and
# may well live on a different instance. Override any of these in the env file
# if yours are named differently.
APP_DB_CONTAINER="${APP_DB_CONTAINER:-postgres}"
SANDBOX_DB_CONTAINER="${SANDBOX_DB_CONTAINER:-postgres}"
MINIO_CONTAINER="${MINIO_CONTAINER:-minio}"

# Creating a role needs a privileged account. The app's own user owns its
# database and is enough for everything on the pgvector instance, but the
# shared Postgres only grants CREATEROLE to its superuser.
APP_DB_ADMIN="${APP_DB_ADMIN:-$SPRING_DATASOURCE_USERNAME}"
SANDBOX_DB_ADMIN="${SANDBOX_DB_ADMIN:-pgadmin}"

# jdbc:postgresql://host:port/NAME -> NAME
APP_DB_NAME="${SPRING_DATASOURCE_URL##*/}"
APP_DB_NAME="${APP_DB_NAME%%\?*}"

# postgres://USER:PASS@host:port/NAME?... The password is percent-encoded in
# the URL, so it has to be decoded before it can be used as a role password.
read -r SANDBOX_DB_USER SANDBOX_DB_PASS SANDBOX_DB_NAME <<<"$(
    python3 - "$SANDBOX_DATABASE_URL" <<'PY'
import sys, urllib.parse as u
p = u.urlparse(sys.argv[1])
print(u.unquote(p.username or ""), u.unquote(p.password or ""), p.path.lstrip("/"))
PY
)"

log "environment:      $ENV_NAME"
log "app database:     $APP_DB_NAME on $APP_DB_CONTAINER (as $APP_DB_ADMIN)"
log "sandbox database: $SANDBOX_DB_NAME (role $SANDBOX_DB_USER) on $SANDBOX_DB_CONTAINER (as $SANDBOX_DB_ADMIN)"
log "bucket:           $MINIO_BUCKET on $MINIO_CONTAINER"

# psql reads the statements from stdin, so nothing has to survive a round of
# shell quoting on the way through ssh and docker exec.
remote_psql() {
    local container="$1" database="$2" user="$3"
    ssh_run "docker exec -i '$container' psql -v ON_ERROR_STOP=1 -q -U '$user' -d '$database'"
}

log "[1/4] application database"
# CREATE DATABASE cannot run inside a DO block; \gexec runs the generated
# statement only when the SELECT returns a row.
remote_psql "$APP_DB_CONTAINER" postgres "$APP_DB_ADMIN" <<SQL
SELECT format('CREATE DATABASE %I OWNER %I', '$APP_DB_NAME', '$SPRING_DATASOURCE_USERNAME')
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '$APP_DB_NAME')\gexec
SQL

log "[2/4] pgvector extension"
# Embeddings are pgvector columns; the Flyway migrations assume the extension
# is already there.
remote_psql "$APP_DB_CONTAINER" "$APP_DB_NAME" "$APP_DB_ADMIN" <<SQL
CREATE EXTENSION IF NOT EXISTS vector;
SQL

log "[3/4] sandbox database and role"
remote_psql "$SANDBOX_DB_CONTAINER" postgres "$SANDBOX_DB_ADMIN" <<SQL
DO \$\$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '$SANDBOX_DB_USER') THEN
        CREATE ROLE $SANDBOX_DB_USER LOGIN PASSWORD '$SANDBOX_DB_PASS';
    END IF;
END
\$\$;
SELECT format('CREATE DATABASE %I OWNER %I', '$SANDBOX_DB_NAME', '$SANDBOX_DB_USER')
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '$SANDBOX_DB_NAME')\gexec
SQL
remote_psql "$SANDBOX_DB_CONTAINER" "$SANDBOX_DB_NAME" "$SANDBOX_DB_ADMIN" <<SQL
GRANT ALL ON SCHEMA public TO $SANDBOX_DB_USER;
SQL

log "[4/4] object storage bucket"
# mc ships inside the MinIO image; the alias is built from the running
# container's own root credentials rather than from anything stored here.
ssh_run "docker exec '$MINIO_CONTAINER' sh -c '
    mc alias set prov http://localhost:9000 \"\$MINIO_ROOT_USER\" \"\$MINIO_ROOT_PASSWORD\" >/dev/null &&
    (mc ls prov/$MINIO_BUCKET >/dev/null 2>&1 || mc mb prov/$MINIO_BUCKET)'"

log "provisioning complete for $ENV_NAME"
