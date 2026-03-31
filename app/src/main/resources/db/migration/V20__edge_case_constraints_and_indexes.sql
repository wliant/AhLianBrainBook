-- Prevent clusters from being their own parent
ALTER TABLE clusters ADD CONSTRAINT check_no_self_parent
    CHECK (parent_cluster_id IS NULL OR parent_cluster_id != id);

-- Prevent neuron self-links
ALTER TABLE neuron_links ADD CONSTRAINT check_no_self_link
    CHECK (source_neuron_id != target_neuron_id);

-- Set parent_cluster_id to NULL when parent is deleted
ALTER TABLE clusters DROP CONSTRAINT IF EXISTS clusters_parent_cluster_id_fkey;
ALTER TABLE clusters ADD CONSTRAINT clusters_parent_cluster_id_fkey
    FOREIGN KEY (parent_cluster_id) REFERENCES clusters(id) ON DELETE SET NULL;

-- Add missing indexes for common queries
CREATE INDEX IF NOT EXISTS idx_neurons_favorite ON neurons (is_favorite) WHERE is_favorite = true AND is_deleted = false;
CREATE INDEX IF NOT EXISTS idx_neurons_pinned ON neurons (is_pinned) WHERE is_pinned = true AND is_deleted = false;
CREATE INDEX IF NOT EXISTS idx_neurons_cluster_active ON neurons (cluster_id) WHERE is_deleted = false;
CREATE INDEX IF NOT EXISTS idx_reminders_neuron_id ON reminders (neuron_id);
