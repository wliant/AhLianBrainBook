-- Add label, link_type, and weight columns to neuron_links
ALTER TABLE neuron_links ADD COLUMN label VARCHAR(255);
ALTER TABLE neuron_links ADD COLUMN link_type VARCHAR(50);
ALTER TABLE neuron_links ADD COLUMN weight DOUBLE PRECISION DEFAULT 1.0;

-- Index for querying links by brain (via neurons)
CREATE INDEX idx_neuron_links_source ON neuron_links(source_neuron_id);
CREATE INDEX idx_neuron_links_target ON neuron_links(target_neuron_id);
