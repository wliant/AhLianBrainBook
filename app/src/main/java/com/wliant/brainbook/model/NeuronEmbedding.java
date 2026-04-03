package com.wliant.brainbook.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "neuron_embeddings")
public class NeuronEmbedding {

    @Id
    @Column(name = "neuron_id", nullable = false)
    private UUID neuronId;

    @Column(name = "model_name", nullable = false, length = 100)
    private String modelName;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    public UUID getNeuronId() { return neuronId; }
    public void setNeuronId(UUID neuronId) { this.neuronId = neuronId; }
    public String getModelName() { return modelName; }
    public void setModelName(String modelName) { this.modelName = modelName; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
}
