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
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import com.wliant.brainbook.config.TimeProvider;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "neuron_revisions")
public class NeuronRevision {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id", updatable = false, nullable = false)
    private UUID id;

    @Column(name = "neuron_id", nullable = false, insertable = false, updatable = false)
    private UUID neuronId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "neuron_id", nullable = false)
    private Neuron neuron;

    @Column(name = "revision_number", nullable = false)
    private int revisionNumber;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "content_json", columnDefinition = "jsonb")
    private String contentJson;

    @Column(name = "content_text", columnDefinition = "text")
    private String contentText;

    @Column(name = "title", length = 500)
    private String title;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        this.createdAt = TimeProvider.now();
    }

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }
    public UUID getNeuronId() { return neuronId; }
    public void setNeuronId(UUID neuronId) { this.neuronId = neuronId; }
    public Neuron getNeuron() { return neuron; }
    public void setNeuron(Neuron neuron) { this.neuron = neuron; }
    public int getRevisionNumber() { return revisionNumber; }
    public void setRevisionNumber(int revisionNumber) { this.revisionNumber = revisionNumber; }
    public String getContentJson() { return contentJson; }
    public void setContentJson(String contentJson) { this.contentJson = contentJson; }
    public String getContentText() { return contentText; }
    public void setContentText(String contentText) { this.contentText = contentText; }
    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
