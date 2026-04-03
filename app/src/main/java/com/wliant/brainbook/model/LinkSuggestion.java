package com.wliant.brainbook.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "link_suggestions")
public class LinkSuggestion {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id", updatable = false, nullable = false)
    private UUID id;

    @Column(name = "source_neuron_id", nullable = false, insertable = false, updatable = false)
    private UUID sourceNeuronId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "source_neuron_id", nullable = false)
    private Neuron sourceNeuron;

    @Column(name = "target_neuron_id", nullable = false, insertable = false, updatable = false)
    private UUID targetNeuronId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "target_neuron_id", nullable = false)
    private Neuron targetNeuron;

    @Column(name = "suggestion_type", nullable = false, length = 20)
    private String suggestionType;

    @Column(name = "score")
    private Double score = 1.0;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        this.createdAt = LocalDateTime.now();
    }

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }
    public UUID getSourceNeuronId() { return sourceNeuronId; }
    public void setSourceNeuronId(UUID sourceNeuronId) { this.sourceNeuronId = sourceNeuronId; }
    public Neuron getSourceNeuron() { return sourceNeuron; }
    public void setSourceNeuron(Neuron sourceNeuron) { this.sourceNeuron = sourceNeuron; }
    public UUID getTargetNeuronId() { return targetNeuronId; }
    public void setTargetNeuronId(UUID targetNeuronId) { this.targetNeuronId = targetNeuronId; }
    public Neuron getTargetNeuron() { return targetNeuron; }
    public void setTargetNeuron(Neuron targetNeuron) { this.targetNeuron = targetNeuron; }
    public String getSuggestionType() { return suggestionType; }
    public void setSuggestionType(String suggestionType) { this.suggestionType = suggestionType; }
    public Double getScore() { return score; }
    public void setScore(Double score) { this.score = score; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
