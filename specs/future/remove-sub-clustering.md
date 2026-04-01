# Remove Sub-Clustering

## Context

Clusters support hierarchical nesting via `parent_cluster_id`, but the UI never exposed the ability to create or manage sub-clusters. The feature is unused and adds unnecessary complexity to the data model. Remove it to simplify the Brain → Cluster → Neuron hierarchy to a strict three-level structure.

## Current State

- `clusters` table has `parent_cluster_id UUID REFERENCES clusters(id)` column
- `Cluster` model, `ClusterRequest` DTO, and `ClusterResponse` DTO all include `parentClusterId`
- Sidebar `ClusterItem` component has recursive rendering logic for nested clusters
- No UI exists to create or reparent sub-clusters — the field is always null in practice
- Frontend `Cluster` type includes `parentClusterId: string | null`
- Brain export format includes `parentClusterId` per cluster

## Changes Required

### Database
- Flyway migration: drop `parent_cluster_id` column from `clusters` table
- Verify no rows have non-null `parent_cluster_id` before migration (safety check)

### Backend (`app/`)
- `Cluster.java`: remove `parentClusterId` field and getter/setter
- `ClusterRequest.java`: remove `parentClusterId` field
- `ClusterResponse.java`: remove `parentClusterId` field
- `ClusterService.java`: remove any `parentClusterId` handling in create/update
- `ClusterRepository.java`: remove any queries filtering by parent

### Frontend (`web/`)
- `types/index.ts`: remove `parentClusterId` from `Cluster` interface and `BrainExport` cluster type
- `Sidebar.tsx`: remove recursive `ClusterItem` nesting logic, simplify to flat cluster list per brain
- `useClusters.ts`: remove any `parentClusterId` references

### Tests
- Update any tests that reference `parentClusterId`
