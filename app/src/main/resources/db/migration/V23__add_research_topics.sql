ALTER TABLE clusters ADD COLUMN research_goal TEXT;

CREATE TABLE research_topics (
    id UUID PRIMARY KEY,
    cluster_id UUID NOT NULL REFERENCES clusters(id) ON DELETE CASCADE,
    brain_id UUID NOT NULL REFERENCES brains(id),
    title VARCHAR(255) NOT NULL,
    prompt TEXT,
    content_json JSONB,
    overall_completeness VARCHAR(20) NOT NULL DEFAULT 'none',
    last_refreshed_at TIMESTAMP,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL,
    created_by VARCHAR(100) NOT NULL,
    last_updated_by VARCHAR(100) NOT NULL,
    CONSTRAINT check_research_topic_completeness
        CHECK (overall_completeness IN ('none', 'partial', 'good', 'complete'))
);

CREATE INDEX idx_research_topics_cluster ON research_topics(cluster_id);
CREATE INDEX idx_research_topics_brain ON research_topics(brain_id);
