-- Add GIN index on title for full-text search (content_text already indexed in V1)
CREATE INDEX idx_neurons_title_text ON neurons USING gin(to_tsvector('english', coalesce(title, '')));
