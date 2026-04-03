package com.wliant.brainbook.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "neuron_anchors")
public class NeuronAnchor {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id", updatable = false, nullable = false)
    private UUID id;

    @Column(name = "neuron_id", nullable = false, insertable = false, updatable = false)
    private UUID neuronId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "neuron_id", nullable = false)
    private Neuron neuron;

    @Column(name = "cluster_id", nullable = false, insertable = false, updatable = false)
    private UUID clusterId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "cluster_id", nullable = false)
    private Cluster cluster;

    @Column(name = "file_path", nullable = false, length = 1000)
    private String filePath;

    @Column(name = "start_line", nullable = false)
    private int startLine;

    @Column(name = "end_line", nullable = false)
    private int endLine;

    @Column(name = "content_hash", nullable = false, length = 64)
    private String contentHash;

    @Column(name = "anchored_text", nullable = false, columnDefinition = "text")
    private String anchoredText;

    @Column(name = "commit_sha", length = 40)
    private String commitSha;

    @Column(name = "status", nullable = false, length = 20)
    @Convert(converter = AnchorStatus.JpaConverter.class)
    private AnchorStatus status;

    @Column(name = "drifted_start_line")
    private Integer driftedStartLine;

    @Column(name = "drifted_end_line")
    private Integer driftedEndLine;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        LocalDateTime now = LocalDateTime.now();
        this.createdAt = now;
        this.updatedAt = now;
        if (this.status == null) {
            this.status = AnchorStatus.ACTIVE;
        }
    }

    @PreUpdate
    protected void onUpdate() {
        this.updatedAt = LocalDateTime.now();
    }

    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
    }

    public UUID getNeuronId() {
        return neuronId;
    }

    public Neuron getNeuron() {
        return neuron;
    }

    public void setNeuron(Neuron neuron) {
        this.neuron = neuron;
    }

    public UUID getClusterId() {
        return clusterId;
    }

    public Cluster getCluster() {
        return cluster;
    }

    public void setCluster(Cluster cluster) {
        this.cluster = cluster;
    }

    public String getFilePath() {
        return filePath;
    }

    public void setFilePath(String filePath) {
        this.filePath = filePath;
    }

    public int getStartLine() {
        return startLine;
    }

    public void setStartLine(int startLine) {
        this.startLine = startLine;
    }

    public int getEndLine() {
        return endLine;
    }

    public void setEndLine(int endLine) {
        this.endLine = endLine;
    }

    public String getContentHash() {
        return contentHash;
    }

    public void setContentHash(String contentHash) {
        this.contentHash = contentHash;
    }

    public String getAnchoredText() {
        return anchoredText;
    }

    public void setAnchoredText(String anchoredText) {
        this.anchoredText = anchoredText;
    }

    public String getCommitSha() {
        return commitSha;
    }

    public void setCommitSha(String commitSha) {
        this.commitSha = commitSha;
    }

    public AnchorStatus getStatus() {
        return status;
    }

    public void setStatus(AnchorStatus status) {
        this.status = status;
    }

    public Integer getDriftedStartLine() {
        return driftedStartLine;
    }

    public void setDriftedStartLine(Integer driftedStartLine) {
        this.driftedStartLine = driftedStartLine;
    }

    public Integer getDriftedEndLine() {
        return driftedEndLine;
    }

    public void setDriftedEndLine(Integer driftedEndLine) {
        this.driftedEndLine = driftedEndLine;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }
}
