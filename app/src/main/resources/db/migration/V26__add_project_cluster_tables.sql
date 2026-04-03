-- 1. Remove one-per-brain restriction for project clusters
DROP INDEX IF EXISTS uq_cluster_brain_project;

-- 2. Project configuration (one-to-one with cluster)
CREATE TABLE project_configs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cluster_id      UUID NOT NULL UNIQUE REFERENCES clusters(id) ON DELETE CASCADE,
    repo_url        VARCHAR(2000) NOT NULL,
    default_branch  VARCHAR(255),
    created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 3. Neuron anchors (links neurons to file locations)
CREATE TABLE neuron_anchors (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    neuron_id          UUID NOT NULL UNIQUE REFERENCES neurons(id) ON DELETE CASCADE,
    cluster_id         UUID NOT NULL REFERENCES clusters(id) ON DELETE CASCADE,
    file_path          VARCHAR(1000) NOT NULL,
    start_line         INTEGER NOT NULL,
    end_line           INTEGER NOT NULL,
    content_hash       VARCHAR(64) NOT NULL,
    anchored_text      TEXT NOT NULL,
    commit_sha         VARCHAR(40),
    status             VARCHAR(20) NOT NULL DEFAULT 'active',
    drifted_start_line INTEGER,
    drifted_end_line   INTEGER,
    created_at         TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at         TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT check_anchor_status CHECK (status IN ('active', 'drifted', 'orphaned')),
    CONSTRAINT check_anchor_lines CHECK (start_line >= 1 AND end_line >= start_line),
    CONSTRAINT check_anchor_max_lines CHECK (end_line - start_line <= 100)
);

CREATE INDEX idx_neuron_anchors_cluster ON neuron_anchors(cluster_id);
CREATE INDEX idx_neuron_anchors_file ON neuron_anchors(cluster_id, file_path);
CREATE INDEX idx_neuron_anchors_neuron ON neuron_anchors(neuron_id);
CREATE INDEX idx_neuron_anchors_non_active ON neuron_anchors(status) WHERE status != 'active';
