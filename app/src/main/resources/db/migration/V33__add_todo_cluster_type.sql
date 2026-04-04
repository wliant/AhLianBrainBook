-- Allow 'todo' in cluster type CHECK constraint
ALTER TABLE clusters DROP CONSTRAINT IF EXISTS check_cluster_type;
ALTER TABLE clusters ADD CONSTRAINT check_cluster_type
    CHECK (type IN ('knowledge', 'ai-research', 'project', 'todo'));

-- Timezone for 7pm local reminder calculation
ALTER TABLE app_settings ADD COLUMN timezone VARCHAR(50) NOT NULL DEFAULT 'Asia/Singapore';

-- Flag to distinguish auto-generated todo reminders from manual ones
ALTER TABLE reminders ADD COLUMN is_system BOOLEAN NOT NULL DEFAULT FALSE;

-- Todo metadata (one-to-one with neuron)
CREATE TABLE todo_metadata (
    neuron_id    UUID PRIMARY KEY REFERENCES neurons(id) ON DELETE CASCADE,
    due_date     DATE,
    completed    BOOLEAN NOT NULL DEFAULT FALSE,
    completed_at TIMESTAMPTZ,
    effort       VARCHAR(10),
    priority     VARCHAR(20) NOT NULL DEFAULT 'normal',
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_todo_metadata_completed ON todo_metadata(completed);
CREATE INDEX idx_todo_metadata_due_date ON todo_metadata(due_date);
