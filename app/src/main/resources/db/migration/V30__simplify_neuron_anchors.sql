-- Simplify neuron_anchors: remove line-range, drift, and reconciliation columns.
-- Anchors now link neurons to file paths only.

-- Drop constraints
ALTER TABLE neuron_anchors DROP CONSTRAINT IF EXISTS check_anchor_status;
ALTER TABLE neuron_anchors DROP CONSTRAINT IF EXISTS check_anchor_lines;
ALTER TABLE neuron_anchors DROP CONSTRAINT IF EXISTS check_anchor_max_lines;

-- Drop index for status-based filtering
DROP INDEX IF EXISTS idx_neuron_anchors_non_active;

-- Drop columns
ALTER TABLE neuron_anchors
    DROP COLUMN IF EXISTS start_line,
    DROP COLUMN IF EXISTS end_line,
    DROP COLUMN IF EXISTS content_hash,
    DROP COLUMN IF EXISTS anchored_text,
    DROP COLUMN IF EXISTS commit_sha,
    DROP COLUMN IF EXISTS status,
    DROP COLUMN IF EXISTS drifted_start_line,
    DROP COLUMN IF EXISTS drifted_end_line;
