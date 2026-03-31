CREATE TABLE neuron_shares (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    neuron_id UUID NOT NULL REFERENCES neurons(id) ON DELETE CASCADE,
    token VARCHAR(64) NOT NULL UNIQUE,
    expires_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX idx_neuron_shares_token ON neuron_shares(token);
CREATE INDEX idx_neuron_shares_neuron_id ON neuron_shares(neuron_id);
