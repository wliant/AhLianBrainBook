-- name: GetByClusterID :one
SELECT * FROM sandboxes WHERE cluster_id = $1;

-- name: GetByID :one
SELECT * FROM sandboxes WHERE id = $1;

-- name: ListByBrainID :many
SELECT * FROM sandboxes WHERE brain_id = $1;

-- name: ListByStatus :many
SELECT * FROM sandboxes WHERE status = $1;

-- name: ListActive :many
SELECT * FROM sandboxes WHERE status = 'active';

-- name: CountByStatuses :one
SELECT COUNT(*) FROM sandboxes WHERE status = ANY($1::text[]);

-- name: SumDiskUsageActive :one
SELECT COALESCE(SUM(disk_usage_bytes), 0)::bigint FROM sandboxes WHERE status = 'active' AND disk_usage_bytes IS NOT NULL;

-- name: FindStale :many
SELECT * FROM sandboxes WHERE status = 'active' AND last_accessed_at < $1;

-- name: Insert :one
INSERT INTO sandboxes (
    cluster_id, brain_id, repo_url, current_branch, sandbox_path, is_shallow, status
) VALUES ($1, $2, $3, $4, $5, $6, $7)
RETURNING *;

-- name: UpdateStatus :exec
UPDATE sandboxes SET status = $2, updated_at = NOW() WHERE id = $1;

-- name: UpdateStatusWithError :exec
UPDATE sandboxes SET status = $2, error_message = $3, updated_at = NOW() WHERE id = $1;

-- name: UpdateAfterClone :exec
UPDATE sandboxes
SET status = 'active', current_commit = $2, disk_usage_bytes = $3, updated_at = NOW()
WHERE id = $1;

-- name: UpdateAfterPull :exec
UPDATE sandboxes
SET current_commit = $2, last_accessed_at = NOW(), updated_at = NOW()
WHERE id = $1;

-- name: UpdateAfterCheckout :exec
UPDATE sandboxes
SET current_branch = $2, current_commit = $3, last_accessed_at = NOW(), updated_at = NOW()
WHERE id = $1;

-- name: UpdateLastAccessed :exec
UPDATE sandboxes SET last_accessed_at = NOW(), updated_at = NOW() WHERE id = $1;

-- name: UpdateSandboxPath :exec
UPDATE sandboxes SET sandbox_path = $2, updated_at = NOW() WHERE id = $1;

-- name: ClearErrorAndSetCloning :exec
UPDATE sandboxes
SET status = 'cloning', error_message = NULL, updated_at = NOW()
WHERE id = $1;

-- name: Delete :exec
DELETE FROM sandboxes WHERE id = $1;

-- name: DeleteByBrainID :execrows
DELETE FROM sandboxes WHERE brain_id = $1;
