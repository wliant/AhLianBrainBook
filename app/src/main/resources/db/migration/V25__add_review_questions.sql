-- Add configurable question count to spaced repetition items
ALTER TABLE spaced_repetition_items
    ADD COLUMN question_count INTEGER NOT NULL DEFAULT 5;

-- Pre-generated Q&A for spaced repetition review
CREATE TABLE review_questions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sr_item_id      UUID NOT NULL REFERENCES spaced_repetition_items(id) ON DELETE CASCADE,
    neuron_id       UUID NOT NULL REFERENCES neurons(id) ON DELETE CASCADE,
    question_text   TEXT NOT NULL,
    answer_text     TEXT NOT NULL,
    question_order  INTEGER NOT NULL DEFAULT 0,
    content_hash    VARCHAR(64),
    status          VARCHAR(20) NOT NULL DEFAULT 'READY',
    created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_review_questions_sr_item ON review_questions(sr_item_id);
CREATE INDEX idx_review_questions_neuron ON review_questions(neuron_id);
CREATE INDEX idx_review_questions_status ON review_questions(status);
