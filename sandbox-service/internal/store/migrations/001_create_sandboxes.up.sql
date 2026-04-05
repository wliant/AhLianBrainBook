CREATE TABLE sandboxes (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cluster_id        UUID NOT NULL UNIQUE,
    brain_id          UUID NOT NULL,
    repo_url          VARCHAR(2000) NOT NULL,
    current_branch    VARCHAR(255) NOT NULL,
    current_commit    VARCHAR(40),
    sandbox_path      VARCHAR(500) NOT NULL,
    is_shallow        BOOLEAN NOT NULL DEFAULT true,
    status            VARCHAR(20) NOT NULL DEFAULT 'cloning'
                      CHECK (status IN ('cloning','indexing','active','error','terminating')),
    disk_usage_bytes  BIGINT,
    error_message     TEXT,
    last_accessed_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sandboxes_cluster ON sandboxes(cluster_id);
CREATE INDEX idx_sandboxes_brain ON sandboxes(brain_id);
CREATE INDEX idx_sandboxes_status ON sandboxes(status);
CREATE INDEX idx_sandboxes_last_accessed ON sandboxes(last_accessed_at);
