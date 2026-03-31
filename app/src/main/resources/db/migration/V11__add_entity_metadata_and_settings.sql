-- Settings table (single row for app-wide configuration)
CREATE TABLE app_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    display_name VARCHAR(100) NOT NULL DEFAULT 'user',
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Seed default settings row
INSERT INTO app_settings (display_name) VALUES ('user');

-- Add created_by and last_updated_by to brains, clusters, neurons
-- DEFAULT 'user' backfills existing rows automatically
ALTER TABLE brains ADD COLUMN created_by VARCHAR(100) NOT NULL DEFAULT 'user';
ALTER TABLE brains ADD COLUMN last_updated_by VARCHAR(100) NOT NULL DEFAULT 'user';

ALTER TABLE clusters ADD COLUMN created_by VARCHAR(100) NOT NULL DEFAULT 'user';
ALTER TABLE clusters ADD COLUMN last_updated_by VARCHAR(100) NOT NULL DEFAULT 'user';

ALTER TABLE neurons ADD COLUMN created_by VARCHAR(100) NOT NULL DEFAULT 'user';
ALTER TABLE neurons ADD COLUMN last_updated_by VARCHAR(100) NOT NULL DEFAULT 'user';
