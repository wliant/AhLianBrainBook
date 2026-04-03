CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE neuron_embeddings (
    neuron_id   UUID PRIMARY KEY REFERENCES neurons(id) ON DELETE CASCADE,
    embedding   vector(768),
    model_name  VARCHAR(100) NOT NULL,
    updated_at  TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE link_suggestions (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_neuron_id  UUID NOT NULL REFERENCES neurons(id) ON DELETE CASCADE,
    target_neuron_id  UUID NOT NULL REFERENCES neurons(id) ON DELETE CASCADE,
    suggestion_type   VARCHAR(20) NOT NULL,
    score             DOUBLE PRECISION DEFAULT 1.0,
    created_at        TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE (source_neuron_id, target_neuron_id, suggestion_type)
);

CREATE INDEX idx_link_suggestions_source ON link_suggestions(source_neuron_id);
CREATE INDEX idx_link_suggestions_target ON link_suggestions(target_neuron_id);
CREATE INDEX idx_neuron_embeddings_hnsw ON neuron_embeddings
    USING hnsw (embedding vector_cosine_ops);
