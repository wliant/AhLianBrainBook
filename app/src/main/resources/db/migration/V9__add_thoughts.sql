CREATE TABLE thoughts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    neuron_tag_mode VARCHAR(10) NOT NULL DEFAULT 'any',
    brain_tag_mode VARCHAR(10) NOT NULL DEFAULT 'any',
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE thought_neuron_tags (
    thought_id UUID NOT NULL REFERENCES thoughts(id) ON DELETE CASCADE,
    tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (thought_id, tag_id)
);

CREATE TABLE thought_brain_tags (
    thought_id UUID NOT NULL REFERENCES thoughts(id) ON DELETE CASCADE,
    tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (thought_id, tag_id)
);
