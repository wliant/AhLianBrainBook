ALTER TABLE app_settings
    ADD COLUMN default_share_cluster_id UUID REFERENCES clusters(id) ON DELETE SET NULL;
