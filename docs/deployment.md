# Deployment

BrainBook runs in three environments that are built the same way and differ
only in their env file.

| Environment | Where it runs | Project | Built |
|---|---|---|---|
| `local` | your machine | `brainbook-local` | from source |
| `dev` | the target host | `brainbook-dev` | pulled from the registry |
| `prod` | the target host | `brainbook-prod` | pulled from the registry |

Each environment's host, port, registry and credentials live in its
`deployment/.env.<env>`, which is gitignored and never in this repo.

Images are **always built on your machine** and pushed to `$REGISTRY`. Nothing
is ever built on a target host, and no git clone lives there - a deploy copies
exactly two files, the compose file and the env file.

## One port, one origin

Each environment publishes a single port. An nginx container (`proxy/`) is the
only thing behind it:

```
browser ──▶ :PORT  proxy
                   ├─ /          → web:3000   (Next.js, standalone)
                   ├─ /api/      → app:8080   (buffering off, 50m bodies)
                   └─ /actuator/ → app:8080
```

`app`, `web`, `intelligence-service` and `sandbox-service` publish nothing.
The browser reaches the API same-origin at `/api`, so `CORS_ALLOWED_ORIGINS`
is no longer what makes the app work, and the frontend bundle contains no
API hostname at all - `NEXT_PUBLIC_API_URL` is built empty and every request
is relative (`web/src/lib/apiBase.ts`). That is what lets one image serve dev
and prod, and what lets a tested dev image be promoted to prod unchanged.

## Deploying

```bash
scripts/deploy.sh dev              # build → push → ship → start, at HEAD's SHA
scripts/deploy.sh prod             # same, with a typed confirmation
scripts/deploy.sh prod a1b2c3d     # an explicit tag
scripts/rollback.sh prod 42521e7   # redeploy an older tag, no rebuild
```

The tag is the short git SHA by default: a commit is the unit of release, so a
rollback is just an older SHA. `deploy.sh prod` refuses a dirty working tree
(`--allow-dirty` overrides) because then the SHA would no longer identify what
was built.

The script builds all five images, pushes them, copies
`deployment/docker-compose.<env>.yml` and `deployment/.env.<env>` to
`$DEPLOY_DIR`, runs `docker compose pull && up -d --remove-orphans` there, and
polls `/actuator/health` through the published port until it reports `UP`.

All SSH goes through `ssh_run` in `scripts/lib/common.sh`. Nobody should be
logging into a server to run a step by hand - if a step is missing, add it to
the script.

## Env files

`deployment/.env.dev` and `.env.prod` are gitignored and are the only files
carrying credentials to a target host. Copy `deployment/.env.example` and fill
it in. Each file is read twice: by docker compose for `${...}` interpolation
(`REGISTRY`, `IMAGE_TAG`, `WEB_PORT`, `SANDBOX_DATABASE_URL`) and as `env_file`
for the app, intelligence and sandbox containers.

## Backing services

Postgres and MinIO are **provided infrastructure outside the application
stack** and are never created, migrated or deleted by a deploy:

Each environment needs three things of its own, named in its env file:

- an **application database** (`SPRING_DATASOURCE_URL`) on a Postgres with
  pgvector, for the embeddings
- a **sandbox database and role** (`SANDBOX_DATABASE_URL`) for cloned
  project-cluster repos
- an **object storage bucket** (`MINIO_BUCKET`)

Give dev its own of each. That is what makes it safe to point the e2e suite at
a deployed environment.

`scripts/provision.sh <dev|prod>` creates whatever is missing. It is idempotent
and only ever creates, so running it against prod cannot disturb live data. It
reaches the two Postgres instances and MinIO by container name - override
`APP_DB_CONTAINER`, `SANDBOX_DB_CONTAINER`, `MINIO_CONTAINER` if yours differ.
Creating a role needs a privileged account, hence `SANDBOX_DB_ADMIN`.

The one piece of data the stack itself owns is the `sandbox-data` volume -
cloned project-cluster repos, recreatable by re-cloning.

## Migrating from a build-on-target deployment

If an environment currently runs from a git clone on the host with
`docker compose up --build`, move it over like this. Nothing here changes a
schema or rewrites data, so every step is reversible.

```bash
# 1. Back up, even though the migration changes neither schema nor data.
ssh "$SSH_USER@$DEPLOY_HOST" \
  'docker exec <pg-container> pg_dump -U <user> --format=custom <db>' \
  > brainbook-$(date +%F).dump

# 2. Carry the cloned sandboxes into the new compose project's volume.
#    Compare `du -sb` on both before continuing.
ssh "$SSH_USER@$DEPLOY_HOST" '
  docker volume create brainbook-prod_sandbox-data &&
  docker run --rm -v <old-project>_sandbox-data:/from \
                  -v brainbook-prod_sandbox-data:/to \
                  alpine sh -c "cp -a /from/. /to/"'

# 3. Free the port. Note: down, never down -v - the latter deletes the volume.
ssh "$SSH_USER@$DEPLOY_HOST" 'cd <old-dir> &&
  docker compose -f docker-compose.prod.yml --env-file .env down'

# 4. Deploy. Downtime is only steps 3-4; build and push beforehand to shorten it.
scripts/deploy.sh prod
```

Then check the public URL: the UI loads, API calls return 200 same-origin, an
attachment downloads, and an AI-assist stream runs to completion.

To roll back, bring the old stack up again with its unchanged compose file -
its images and volume are still on the host and nothing was migrated
destructively. Clean those up only once you are confident, and retire any
separate API hostname: the API no longer has an origin of its own.
