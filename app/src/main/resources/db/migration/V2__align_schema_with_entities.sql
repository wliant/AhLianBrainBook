-- Align attachments table columns with JPA entity
ALTER TABLE attachments RENAME COLUMN storage_key TO file_path;
ALTER TABLE attachments RENAME COLUMN filename TO file_name;
ALTER TABLE attachments RENAME COLUMN mime_type TO content_type;
ALTER TABLE attachments RENAME COLUMN size_bytes TO file_size;

-- Add sort_order to neurons (entity expects it)
ALTER TABLE neurons ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0;

-- Add updated_at to tags (entity expects it)
ALTER TABLE tags ADD COLUMN updated_at TIMESTAMP NOT NULL DEFAULT NOW();

-- Drop columns from neuron_revisions that entity doesn't map
-- (reason and snapshot_name exist in SQL but not in entity)
ALTER TABLE neuron_revisions DROP COLUMN reason;
ALTER TABLE neuron_revisions DROP COLUMN snapshot_name;
