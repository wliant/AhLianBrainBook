# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

BrainBook — a personal technical notebook. Spring Boot 3.4.4 (Java 21) backend, Next.js 16 (React 19, TypeScript) frontend, PostgreSQL 16, MinIO for file storage.

## Commands

### Infrastructure
```bash
docker compose -f docker-compose.infra.yml up -d          # postgres + minio
docker compose -f docker-compose.infra.yml -f docker-compose.app.yml up -d  # full stack
```

### Backend (from `backend/`)
```bash
./mvnw spring-boot:run          # run locally (needs postgres + minio running)
./mvnw package -DskipTests      # build JAR
./mvnw test                     # run all tests
./mvnw test -Dtest=ClassName    # run single test class
```

### Frontend (from `frontend/`)
```bash
npm install
npm run dev       # dev server on :3000
npm run build     # production build
npm run lint      # next lint
```

## Architecture

### Domain Model
Brain → Cluster (nested tree via parent_id) → Neuron (rich text notes). Neurons support tags, attachments (MinIO), revisions (autosave/snapshot), links between neurons, favorites, pinning, and soft delete (trash).

### Backend (`backend/src/main/java/com/ahlian/brainbook/`)
Standard layered Spring Boot: `controller/` → `service/` → `repository/` → `model/`. DTOs in `dto/`, config in `config/` (CORS, MinIO client). Database migrations via Flyway in `src/main/resources/db/migration/`. Neuron content stored as JSONB with a separate plain-text column for full-text search indexing.

### Frontend (`frontend/src/`)
Next.js App Router with nested routes: `app/brain/[brainId]/cluster/[clusterId]/neuron/[neuronId]/`. API client in `lib/api.ts` wraps fetch. Custom hooks in `lib/hooks/` (useBrains, useClusters, useNeurons). Rich text editor uses TipTap (`components/editor/`). UI built with Radix primitives + Tailwind CSS (`components/ui/`).

### Key Config
- Backend port: 8080, Frontend port: 3000
- MinIO API: 9000, Console: 9001
- Max upload: 50MB
- Neuron optimistic locking via `version` field
- Frontend output mode: `standalone` (for Docker)
