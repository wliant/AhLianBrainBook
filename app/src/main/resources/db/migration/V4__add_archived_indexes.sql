-- Add indexes for is_archived columns used in filter queries
CREATE INDEX IF NOT EXISTS idx_neurons_archived ON neurons(is_archived);
CREATE INDEX IF NOT EXISTS idx_clusters_archived ON clusters(is_archived);
CREATE INDEX IF NOT EXISTS idx_brains_archived ON brains(is_archived);
