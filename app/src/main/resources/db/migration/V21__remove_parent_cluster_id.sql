ALTER TABLE clusters DROP CONSTRAINT IF EXISTS check_no_self_parent;
ALTER TABLE clusters DROP CONSTRAINT IF EXISTS clusters_parent_cluster_id_fkey;
ALTER TABLE clusters DROP COLUMN IF EXISTS parent_cluster_id;
