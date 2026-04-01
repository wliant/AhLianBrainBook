package com.wliant.brainbook.model;

import jakarta.persistence.Column;
import jakarta.persistence.Convert;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "research_topics")
public class ResearchTopic {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id", updatable = false, nullable = false)
    private UUID id;

    @Column(name = "cluster_id", nullable = false, insertable = false, updatable = false)
    private UUID clusterId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "cluster_id", nullable = false)
    private Cluster cluster;

    @Column(name = "brain_id", nullable = false, insertable = false, updatable = false)
    private UUID brainId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "brain_id", nullable = false)
    private Brain brain;

    @Column(name = "title", nullable = false)
    private String title;

    @Column(name = "prompt", columnDefinition = "text")
    private String prompt;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "content_json", columnDefinition = "jsonb")
    private String contentJson;

    @Column(name = "overall_completeness", nullable = false, length = 20)
    @Convert(converter = CompletenessLevel.JpaConverter.class)
    private CompletenessLevel overallCompleteness;

    @Column(name = "last_refreshed_at")
    private LocalDateTime lastRefreshedAt;

    @Column(name = "sort_order", nullable = false)
    private int sortOrder;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @Column(name = "created_by", nullable = false, length = 100)
    private String createdBy;

    @Column(name = "last_updated_by", nullable = false, length = 100)
    private String lastUpdatedBy;

    @PrePersist
    protected void onCreate() {
        LocalDateTime now = LocalDateTime.now();
        this.createdAt = now;
        this.updatedAt = now;
        if (this.overallCompleteness == null) {
            this.overallCompleteness = CompletenessLevel.NONE;
        }
    }

    @PreUpdate
    protected void onUpdate() {
        this.updatedAt = LocalDateTime.now();
    }

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }
    public UUID getClusterId() { return clusterId; }
    public Cluster getCluster() { return cluster; }
    public void setCluster(Cluster cluster) { this.cluster = cluster; }
    public UUID getBrainId() { return brainId; }
    public Brain getBrain() { return brain; }
    public void setBrain(Brain brain) { this.brain = brain; }
    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
    public String getPrompt() { return prompt; }
    public void setPrompt(String prompt) { this.prompt = prompt; }
    public String getContentJson() { return contentJson; }
    public void setContentJson(String contentJson) { this.contentJson = contentJson; }
    public CompletenessLevel getOverallCompleteness() { return overallCompleteness; }
    public void setOverallCompleteness(CompletenessLevel overallCompleteness) { this.overallCompleteness = overallCompleteness; }
    public LocalDateTime getLastRefreshedAt() { return lastRefreshedAt; }
    public void setLastRefreshedAt(LocalDateTime lastRefreshedAt) { this.lastRefreshedAt = lastRefreshedAt; }
    public int getSortOrder() { return sortOrder; }
    public void setSortOrder(int sortOrder) { this.sortOrder = sortOrder; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public String getCreatedBy() { return createdBy; }
    public void setCreatedBy(String createdBy) { this.createdBy = createdBy; }
    public String getLastUpdatedBy() { return lastUpdatedBy; }
    public void setLastUpdatedBy(String lastUpdatedBy) { this.lastUpdatedBy = lastUpdatedBy; }
}
