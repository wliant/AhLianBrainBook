ALTER TABLE clusters ADD COLUMN type VARCHAR(20) NOT NULL DEFAULT 'knowledge';

ALTER TABLE clusters ADD CONSTRAINT check_cluster_type
    CHECK (type IN ('knowledge', 'ai-research', 'project'));

CREATE UNIQUE INDEX uq_cluster_brain_ai_research
    ON clusters(brain_id) WHERE type = 'ai-research' AND is_archived = false;

CREATE UNIQUE INDEX uq_cluster_brain_project
    ON clusters(brain_id) WHERE type = 'project' AND is_archived = false;
