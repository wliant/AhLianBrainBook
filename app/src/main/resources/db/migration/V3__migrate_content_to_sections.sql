-- Migrate existing neuron content from TipTap doc format to sections format
UPDATE neurons
SET content_json = jsonb_build_object(
    'version', 2,
    'sections', jsonb_build_array(
        jsonb_build_object(
            'id', gen_random_uuid()::text,
            'type', 'rich-text',
            'order', 0,
            'content', content_json,
            'meta', '{}'::jsonb
        )
    )
)
WHERE content_json IS NOT NULL
  AND content_json->>'type' = 'doc';

-- Migrate revision snapshots
UPDATE neuron_revisions
SET content_json = jsonb_build_object(
    'version', 2,
    'sections', jsonb_build_array(
        jsonb_build_object(
            'id', gen_random_uuid()::text,
            'type', 'rich-text',
            'order', 0,
            'content', content_json,
            'meta', '{}'::jsonb
        )
    )
)
WHERE content_json IS NOT NULL
  AND content_json->>'type' = 'doc';
