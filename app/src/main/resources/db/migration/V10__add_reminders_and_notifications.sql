-- Reminders: one active reminder per neuron
CREATE TABLE reminders (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    neuron_id           UUID NOT NULL REFERENCES neurons(id) ON DELETE CASCADE,
    reminder_type       VARCHAR(20) NOT NULL,
    trigger_at          TIMESTAMP NOT NULL,
    recurrence_pattern  VARCHAR(20),
    recurrence_interval INTEGER DEFAULT 1,
    is_active           BOOLEAN NOT NULL DEFAULT TRUE,
    created_at          TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_reminders_neuron UNIQUE (neuron_id)
);

-- Notifications: denormalized for frontend navigation
CREATE TABLE notifications (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reminder_id     UUID REFERENCES reminders(id) ON DELETE SET NULL,
    neuron_id       UUID NOT NULL REFERENCES neurons(id) ON DELETE CASCADE,
    brain_id        UUID NOT NULL,
    cluster_id      UUID NOT NULL,
    neuron_title    VARCHAR(500) NOT NULL,
    message         TEXT NOT NULL,
    is_read         BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_reminders_trigger ON reminders(trigger_at) WHERE is_active = TRUE;
CREATE INDEX idx_notifications_unread ON notifications(is_read, created_at DESC);
