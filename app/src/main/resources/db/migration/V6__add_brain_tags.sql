CREATE TABLE brain_tags (
    brain_id UUID NOT NULL REFERENCES brains(id) ON DELETE CASCADE,
    tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (brain_id, tag_id)
);
