-- Convert all TIMESTAMP columns to TIMESTAMPTZ.
-- Existing naive values are interpreted as UTC via the AT TIME ZONE clause.
-- This is a metadata-only change in PostgreSQL (no table rewrite).

-- brains
ALTER TABLE brains ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC';
ALTER TABLE brains ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING updated_at AT TIME ZONE 'UTC';

-- clusters
ALTER TABLE clusters ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC';
ALTER TABLE clusters ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING updated_at AT TIME ZONE 'UTC';

-- templates
ALTER TABLE templates ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC';
ALTER TABLE templates ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING updated_at AT TIME ZONE 'UTC';

-- neurons
ALTER TABLE neurons ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC';
ALTER TABLE neurons ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING updated_at AT TIME ZONE 'UTC';
ALTER TABLE neurons ALTER COLUMN last_edited_at TYPE TIMESTAMPTZ USING last_edited_at AT TIME ZONE 'UTC';

-- tags
ALTER TABLE tags ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC';
ALTER TABLE tags ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING updated_at AT TIME ZONE 'UTC';

-- attachments
ALTER TABLE attachments ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC';

-- neuron_revisions
ALTER TABLE neuron_revisions ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC';

-- neuron_links
ALTER TABLE neuron_links ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC';

-- thoughts
ALTER TABLE thoughts ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC';
ALTER TABLE thoughts ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING updated_at AT TIME ZONE 'UTC';

-- reminders
ALTER TABLE reminders ALTER COLUMN trigger_at TYPE TIMESTAMPTZ USING trigger_at AT TIME ZONE 'UTC';
ALTER TABLE reminders ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC';
ALTER TABLE reminders ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING updated_at AT TIME ZONE 'UTC';

-- notifications
ALTER TABLE notifications ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC';

-- app_settings
ALTER TABLE app_settings ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC';
ALTER TABLE app_settings ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING updated_at AT TIME ZONE 'UTC';

-- spaced_repetition_items
ALTER TABLE spaced_repetition_items ALTER COLUMN next_review_at TYPE TIMESTAMPTZ USING next_review_at AT TIME ZONE 'UTC';
ALTER TABLE spaced_repetition_items ALTER COLUMN last_reviewed_at TYPE TIMESTAMPTZ USING last_reviewed_at AT TIME ZONE 'UTC';
ALTER TABLE spaced_repetition_items ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC';
ALTER TABLE spaced_repetition_items ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING updated_at AT TIME ZONE 'UTC';

-- neuron_shares
ALTER TABLE neuron_shares ALTER COLUMN expires_at TYPE TIMESTAMPTZ USING expires_at AT TIME ZONE 'UTC';
ALTER TABLE neuron_shares ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC';

-- research_topics
ALTER TABLE research_topics ALTER COLUMN last_refreshed_at TYPE TIMESTAMPTZ USING last_refreshed_at AT TIME ZONE 'UTC';
ALTER TABLE research_topics ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC';
ALTER TABLE research_topics ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING updated_at AT TIME ZONE 'UTC';

-- review_questions
ALTER TABLE review_questions ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC';
ALTER TABLE review_questions ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING updated_at AT TIME ZONE 'UTC';

-- project_configs
ALTER TABLE project_configs ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC';
ALTER TABLE project_configs ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING updated_at AT TIME ZONE 'UTC';

-- neuron_anchors
ALTER TABLE neuron_anchors ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC';
ALTER TABLE neuron_anchors ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING updated_at AT TIME ZONE 'UTC';

-- neuron_embeddings
ALTER TABLE neuron_embeddings ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING updated_at AT TIME ZONE 'UTC';

-- link_suggestions
ALTER TABLE link_suggestions ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC';

-- sandboxes
ALTER TABLE sandboxes ALTER COLUMN last_accessed_at TYPE TIMESTAMPTZ USING last_accessed_at AT TIME ZONE 'UTC';
ALTER TABLE sandboxes ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC';
ALTER TABLE sandboxes ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING updated_at AT TIME ZONE 'UTC';
