-- Allow multiple reminders per neuron
ALTER TABLE reminders DROP CONSTRAINT uq_reminders_neuron;

-- Add max reminders setting
ALTER TABLE app_settings ADD COLUMN max_reminders_per_neuron INTEGER NOT NULL DEFAULT 10;
