-- Review question mode: the per-item choice toggle becomes three-valued so an item can ask
-- for multiple choice *only*, not just "allow multiple choice".
--   FREE_TEXT   = the old choice_questions_enabled = false
--   MIXED       = the old true (agent picks a format per question)
--   CHOICE_ONLY = new; free-text questions are dropped rather than kept
ALTER TABLE spaced_repetition_items
    ADD COLUMN question_mode VARCHAR(20) NOT NULL DEFAULT 'MIXED';

UPDATE spaced_repetition_items
SET question_mode = 'FREE_TEXT'
WHERE choice_questions_enabled = false;

ALTER TABLE spaced_repetition_items
    DROP COLUMN choice_questions_enabled;

-- The count is now picked from {5, 10, 20, 50}; existing values are 1-10, so snap each
-- to the nearer of the two values that survive.
UPDATE spaced_repetition_items
SET question_count = CASE WHEN question_count <= 7 THEN 5 ELSE 10 END;

ALTER TABLE spaced_repetition_items
    ALTER COLUMN question_count SET DEFAULT 5;
