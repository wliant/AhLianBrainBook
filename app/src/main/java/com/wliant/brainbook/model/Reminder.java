package com.wliant.brainbook.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
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

import com.wliant.brainbook.config.TimeProvider;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "reminders")
public class Reminder {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id", updatable = false, nullable = false)
    private UUID id;

    @Column(name = "neuron_id", nullable = false, insertable = false, updatable = false)
    private UUID neuronId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "neuron_id", nullable = false)
    private Neuron neuron;

    @Enumerated(EnumType.STRING)
    @Column(name = "reminder_type", nullable = false, length = 20)
    private ReminderType reminderType;

    @Column(name = "trigger_at", nullable = false)
    private LocalDateTime triggerAt;

    @Enumerated(EnumType.STRING)
    @Column(name = "recurrence_pattern", length = 20)
    private RecurrencePattern recurrencePattern;

    @Column(name = "recurrence_interval")
    private Integer recurrenceInterval = 1;

    @Column(name = "is_active", nullable = false)
    private boolean isActive = true;

    @Column(name = "is_system", nullable = false)
    private boolean isSystem = false;

    @Column(name = "title")
    private String title;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "description", columnDefinition = "jsonb")
    private String description;

    @Column(name = "description_text", columnDefinition = "text")
    private String descriptionText;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

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

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }
    public UUID getNeuronId() { return neuronId; }
    public void setNeuronId(UUID neuronId) { this.neuronId = neuronId; }
    public Neuron getNeuron() { return neuron; }
    public void setNeuron(Neuron neuron) { this.neuron = neuron; }
    public ReminderType getReminderType() { return reminderType; }
    public void setReminderType(ReminderType reminderType) { this.reminderType = reminderType; }
    public LocalDateTime getTriggerAt() { return triggerAt; }
    public void setTriggerAt(LocalDateTime triggerAt) { this.triggerAt = triggerAt; }
    public RecurrencePattern getRecurrencePattern() { return recurrencePattern; }
    public void setRecurrencePattern(RecurrencePattern recurrencePattern) { this.recurrencePattern = recurrencePattern; }
    public Integer getRecurrenceInterval() { return recurrenceInterval; }
    public void setRecurrenceInterval(Integer recurrenceInterval) { this.recurrenceInterval = recurrenceInterval; }
    public boolean isActive() { return isActive; }
    public void setActive(boolean active) { isActive = active; }
    public boolean isSystem() { return isSystem; }
    public void setSystem(boolean system) { isSystem = system; }
    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
    public String getDescriptionText() { return descriptionText; }
    public void setDescriptionText(String descriptionText) { this.descriptionText = descriptionText; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
}
