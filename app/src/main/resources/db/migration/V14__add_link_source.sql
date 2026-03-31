-- Track whether a neuron link was created manually or from editor [[wiki-link]] syntax
ALTER TABLE neuron_links ADD COLUMN source VARCHAR(20) NOT NULL DEFAULT 'manual';
