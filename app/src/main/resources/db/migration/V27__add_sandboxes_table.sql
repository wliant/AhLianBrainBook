-- V27: Add sandboxes table for server-side git clone management

CREATE TABLE sandboxes (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cluster_id        UUID NOT NULL UNIQUE REFERENCES clusters(id) ON DELETE CASCADE,
    brain_id          UUID NOT NULL REFERENCES brains(id) ON DELETE CASCADE,
    repo_url          VARCHAR(2000) NOT NULL,
    current_branch    VARCHAR(255) NOT NULL,
    current_commit    VARCHAR(40),
    sandbox_path      VARCHAR(500) NOT NULL,
    is_shallow        BOOLEAN NOT NULL DEFAULT true,
    status            VARCHAR(20) NOT NULL DEFAULT 'cloning',
    disk_usage_bytes  BIGINT,
    error_message     TEXT,
    last_accessed_at  TIMESTAMP NOT NULL DEFAULT NOW(),
    created_at        TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT check_sandbox_status
        CHECK (status IN ('cloning', 'indexing', 'active', 'error', 'terminating'))
);

CREATE INDEX idx_sandboxes_cluster ON sandboxes(cluster_id);
CREATE INDEX idx_sandboxes_brain ON sandboxes(brain_id);
CREATE INDEX idx_sandboxes_status ON sandboxes(status);
CREATE INDEX idx_sandboxes_last_accessed ON sandboxes(last_accessed_at);
