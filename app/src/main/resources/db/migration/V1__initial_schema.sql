-- Brains
CREATE TABLE brains (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    icon VARCHAR(50),
    color VARCHAR(7),
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_archived BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Clusters
CREATE TABLE clusters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    brain_id UUID NOT NULL REFERENCES brains(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    parent_cluster_id UUID REFERENCES clusters(id),
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_archived BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Templates
CREATE TABLE templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    content_json JSONB,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Neurons
CREATE TABLE neurons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    brain_id UUID NOT NULL REFERENCES brains(id),
    cluster_id UUID NOT NULL REFERENCES clusters(id),
    title VARCHAR(500) NOT NULL DEFAULT '',
    content_json JSONB,
    content_text TEXT,
    template_id UUID REFERENCES templates(id) ON DELETE SET NULL,
    is_archived BOOLEAN NOT NULL DEFAULT FALSE,
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    is_favorite BOOLEAN NOT NULL DEFAULT FALSE,
    is_pinned BOOLEAN NOT NULL DEFAULT FALSE,
    version INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    last_edited_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Tags
CREATE TABLE tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL UNIQUE,
    color VARCHAR(7),
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE neuron_tags (
    neuron_id UUID NOT NULL REFERENCES neurons(id) ON DELETE CASCADE,
    tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (neuron_id, tag_id)
);

-- Attachments
CREATE TABLE attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    neuron_id UUID NOT NULL REFERENCES neurons(id) ON DELETE CASCADE,
    storage_key VARCHAR(500) NOT NULL,
    filename VARCHAR(255) NOT NULL,
    mime_type VARCHAR(100),
    size_bytes BIGINT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Revisions
CREATE TABLE neuron_revisions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    neuron_id UUID NOT NULL REFERENCES neurons(id) ON DELETE CASCADE,
    revision_number INTEGER NOT NULL,
    content_json JSONB,
    content_text TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    reason VARCHAR(50) NOT NULL DEFAULT 'autosave',
    snapshot_name VARCHAR(255)
);

-- Neuron Links
CREATE TABLE neuron_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_neuron_id UUID NOT NULL REFERENCES neurons(id) ON DELETE CASCADE,
    target_neuron_id UUID NOT NULL REFERENCES neurons(id) ON DELETE CASCADE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE(source_neuron_id, target_neuron_id)
);

-- Indexes
CREATE INDEX idx_clusters_brain_id ON clusters(brain_id);
CREATE INDEX idx_neurons_brain_id ON neurons(brain_id);
CREATE INDEX idx_neurons_cluster_id ON neurons(cluster_id);
CREATE INDEX idx_neurons_deleted ON neurons(is_deleted);
CREATE INDEX idx_neurons_content_text ON neurons USING gin(to_tsvector('english', content_text));
CREATE INDEX idx_neuron_revisions_neuron_id ON neuron_revisions(neuron_id);
CREATE INDEX idx_attachments_neuron_id ON attachments(neuron_id);
