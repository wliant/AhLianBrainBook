CREATE TABLE spaced_repetition_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    neuron_id UUID NOT NULL REFERENCES neurons(id) ON DELETE CASCADE,
    ease_factor DOUBLE PRECISION NOT NULL DEFAULT 2.5,
    interval_days INTEGER NOT NULL DEFAULT 0,
    repetitions INTEGER NOT NULL DEFAULT 0,
    next_review_at TIMESTAMP NOT NULL,
    last_reviewed_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_sr_neuron UNIQUE (neuron_id)
);

CREATE INDEX idx_sr_next_review ON spaced_repetition_items (next_review_at);
