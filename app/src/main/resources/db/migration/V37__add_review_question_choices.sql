-- Multiple-choice review questions (single + multi select).
-- question_type defaults to FREE_TEXT so every existing row keeps its current meaning.
-- answer_text stays NOT NULL: for choice questions it holds the correct option text
-- (correct options joined for multi-select), so existing readers need no change.
ALTER TABLE review_questions
    ADD COLUMN question_type VARCHAR(20) NOT NULL DEFAULT 'FREE_TEXT',
    ADD COLUMN choices       JSONB,
    ADD COLUMN explanation   TEXT;

-- Documents the invariant the service already enforces: a choice question with no
-- options has nothing to select, so it is stored as FREE_TEXT instead.
ALTER TABLE review_questions
    ADD CONSTRAINT chk_review_questions_choices
    CHECK (question_type = 'FREE_TEXT' OR choices IS NOT NULL);

-- Per-item escape hatch, mirroring quiz_enabled: turn choice questions off and
-- regeneration falls back to free-text recall only.
ALTER TABLE spaced_repetition_items
    ADD COLUMN choice_questions_enabled BOOLEAN NOT NULL DEFAULT true;
