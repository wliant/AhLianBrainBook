ALTER TABLE clusters ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT 'ready';
ALTER TABLE clusters ADD CONSTRAINT check_cluster_status CHECK (status IN ('generating', 'ready'));

ALTER TABLE research_topics ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT 'ready';
ALTER TABLE research_topics ADD CONSTRAINT check_research_topic_status CHECK (status IN ('generating', 'ready', 'updating', 'error'));
