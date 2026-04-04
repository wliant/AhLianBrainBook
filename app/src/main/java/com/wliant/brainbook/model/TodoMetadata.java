package com.wliant.brainbook.model;

import jakarta.persistence.Column;
import jakarta.persistence.Convert;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.MapsId;
import jakarta.persistence.OneToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;

import com.wliant.brainbook.config.TimeProvider;
import org.springframework.data.domain.Persistable;

import jakarta.persistence.Transient;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "todo_metadata")
public class TodoMetadata implements Persistable<UUID> {

    @Transient
    private boolean isNew = true;

    @Id
    @Column(name = "neuron_id", updatable = false, nullable = false)
    private UUID neuronId;

    @OneToOne(fetch = FetchType.LAZY)
    @MapsId
    @JoinColumn(name = "neuron_id")
    private Neuron neuron;

    @Column(name = "due_date")
    private LocalDate dueDate;

    @Column(name = "completed", nullable = false)
    private boolean completed = false;

    @Column(name = "completed_at")
    private LocalDateTime completedAt;

    @Convert(converter = TodoEffort.JpaConverter.class)
    @Column(name = "effort", length = 10)
    private TodoEffort effort;

    @Convert(converter = TodoPriority.JpaConverter.class)
    @Column(name = "priority", nullable = false, length = 20)
    private TodoPriority priority = TodoPriority.NORMAL;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @Override
    public UUID getId() { return neuronId; }

    @Override
    public boolean isNew() { return isNew; }

    @PrePersist
    protected void onCreate() {
        LocalDateTime now = TimeProvider.now();
        this.createdAt = now;
        this.updatedAt = now;
    }

    @PreUpdate
    protected void onUpdate() {
        this.updatedAt = TimeProvider.now();
    }

    @jakarta.persistence.PostLoad
    @jakarta.persistence.PostPersist
    protected void markNotNew() {
        this.isNew = false;
    }

    public UUID getNeuronId() { return neuronId; }
    public void setNeuronId(UUID neuronId) { this.neuronId = neuronId; }
    public Neuron getNeuron() { return neuron; }
    public void setNeuron(Neuron neuron) { this.neuron = neuron; }
    public LocalDate getDueDate() { return dueDate; }
    public void setDueDate(LocalDate dueDate) { this.dueDate = dueDate; }
    public boolean isCompleted() { return completed; }
    public void setCompleted(boolean completed) { this.completed = completed; }
    public LocalDateTime getCompletedAt() { return completedAt; }
    public void setCompletedAt(LocalDateTime completedAt) { this.completedAt = completedAt; }
    public TodoEffort getEffort() { return effort; }
    public void setEffort(TodoEffort effort) { this.effort = effort; }
    public TodoPriority getPriority() { return priority; }
    public void setPriority(TodoPriority priority) { this.priority = priority; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
}
