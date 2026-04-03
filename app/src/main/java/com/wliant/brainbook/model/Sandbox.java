package com.wliant.brainbook.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "sandboxes")
public class Sandbox {

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

    @Column(name = "repo_url", nullable = false, length = 2000)
    private String repoUrl;

    @Column(name = "current_branch", nullable = false)
    private String currentBranch;

    @Column(name = "current_commit", length = 40)
    private String currentCommit;

    @Column(name = "sandbox_path", nullable = false, length = 500)
    private String sandboxPath;

    @Column(name = "is_shallow", nullable = false)
    private Boolean isShallow = true;

    @Convert(converter = SandboxStatus.JpaConverter.class)
    @Column(name = "status", nullable = false, length = 20)
    private SandboxStatus status;

    @Column(name = "disk_usage_bytes")
    private Long diskUsageBytes;

    @Column(name = "error_message", columnDefinition = "TEXT")
    private String errorMessage;

    @Column(name = "last_accessed_at", nullable = false)
    private LocalDateTime lastAccessedAt;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        LocalDateTime now = LocalDateTime.now();
        this.createdAt = now;
        this.updatedAt = now;
        this.lastAccessedAt = now;
        if (this.status == null) this.status = SandboxStatus.CLONING;
    }

    @PreUpdate
    protected void onUpdate() {
        this.updatedAt = LocalDateTime.now();
    }

    // Getters and setters

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }

    public UUID getClusterId() { return clusterId; }

    public Cluster getCluster() { return cluster; }
    public void setCluster(Cluster cluster) { this.cluster = cluster; }

    public UUID getBrainId() { return brainId; }

    public Brain getBrain() { return brain; }
    public void setBrain(Brain brain) { this.brain = brain; }

    public String getRepoUrl() { return repoUrl; }
    public void setRepoUrl(String repoUrl) { this.repoUrl = repoUrl; }

    public String getCurrentBranch() { return currentBranch; }
    public void setCurrentBranch(String currentBranch) { this.currentBranch = currentBranch; }

    public String getCurrentCommit() { return currentCommit; }
    public void setCurrentCommit(String currentCommit) { this.currentCommit = currentCommit; }

    public String getSandboxPath() { return sandboxPath; }
    public void setSandboxPath(String sandboxPath) { this.sandboxPath = sandboxPath; }

    public Boolean getIsShallow() { return isShallow; }
    public void setIsShallow(Boolean isShallow) { this.isShallow = isShallow; }

    public SandboxStatus getStatus() { return status; }
    public void setStatus(SandboxStatus status) { this.status = status; }

    public Long getDiskUsageBytes() { return diskUsageBytes; }
    public void setDiskUsageBytes(Long diskUsageBytes) { this.diskUsageBytes = diskUsageBytes; }

    public String getErrorMessage() { return errorMessage; }
    public void setErrorMessage(String errorMessage) { this.errorMessage = errorMessage; }

    public LocalDateTime getLastAccessedAt() { return lastAccessedAt; }
    public void setLastAccessedAt(LocalDateTime lastAccessedAt) { this.lastAccessedAt = lastAccessedAt; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
}
