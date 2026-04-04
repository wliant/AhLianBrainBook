ALTER TABLE reminders
    ADD COLUMN title VARCHAR(255),
    ADD COLUMN description JSONB,
    ADD COLUMN description_text TEXT;
