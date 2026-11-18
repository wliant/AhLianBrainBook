# Deployment

BrainBook runs in three environments that are built the same way and differ
only in their env file.

| Environment | Where it runs | Project | Port | Built |
|---|---|---|---|---|
| `local` | your machine | `brainbook-local` | `13000` | from source |
| `dev` | 192.168.1.248 | `brainbook-dev` | `5991` | pulled from the registry |
| `prod` | 192.168.1.248 | `brainbook-prod` | `5989` | pulled from the registry |

Images are **always built on your machine** and pushed to the registry at
`192.168.1.248:5000`. Nothing is ever built on a target host, and no git clone
lives there - a deploy copies exactly two files, the compose file and the env
file.

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

| | prod | dev |
|---|---|---|
| application DB | `pgvector-bb:5433/brainbook` | `pgvector-bb:5433/brainbook_dev` |
| sandbox DB | `postgres:5432/sandbox` | `postgres:5432/sandbox_dev` |
| bucket | `minio:9000/brainbook-attachments` | `minio:9000/brainbook-dev-attachments` |

`scripts/provision.sh <dev|prod>` creates whatever is missing - database,
pgvector extension, sandbox role and database, bucket. It is idempotent and
only ever creates, so running it against prod cannot disturb live data. Role
creation on the shared Postgres needs its superuser, which is why
`SANDBOX_DB_ADMIN` defaults to `pgadmin`.

The one piece of data the stack itself owns is the `sandbox-data` volume -
cloned project-cluster repos, recreatable by re-cloning.

## First prod cutover

The old deployment was a git clone at `/home/wliant/myapps/AhLianBrainBook`
running `docker compose up --build`. To move to the new one:

```bash
# 1. Back up, even though the migration changes no schema and no data.
ssh wliant@192.168.1.248 'docker exec pgvector-bb pg_dump -U brainbook brainbook' \
  > brainbook-$(date +%F).sql

# 2. Carry the cloned sandboxes across to the new project's volume.
ssh wliant@192.168.1.248 '
  docker volume create brainbook-prod_sandbox-data &&
  docker run --rm -v ahlianbrainbook_sandbox-data:/from \
                  -v brainbook-prod_sandbox-data:/to \
                  alpine sh -c "cp -a /from/. /to/"'

# 3. Free port 5989. Note: down, never down -v - the latter deletes the volume.
ssh wliant@192.168.1.248 'cd /home/wliant/myapps/AhLianBrainBook &&
  docker compose -f docker-compose.prod.yml --env-file .env down'

# 4. Deploy.
scripts/deploy.sh prod
```

Then check `https://brainbook.wliant.org`: the UI loads, API calls return 200
same-origin, an attachment downloads, and an AI-assist stream runs to
completion. If anything is wrong, the old stack's compose file and images are
still on the host and bringing it back up restores the previous state - no
data was migrated destructively.

Once you are confident, delete `myapps/AhLianBrainBook`, remove the
`ahlianbrainbook_sandbox-data` volume, and retire the `brainbook-api.wliant.org`
DNS/TLS entry - the API no longer has an origin of its own.
