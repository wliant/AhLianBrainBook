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

import com.wliant.brainbook.config.TimeProvider;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "review_questions")
public class ReviewQuestion {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id", updatable = false, nullable = false)
    private UUID id;

    @Column(name = "sr_item_id", nullable = false, insertable = false, updatable = false)
    private UUID srItemId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "sr_item_id", nullable = false)
    private SpacedRepetitionItem srItem;

    @Column(name = "neuron_id", nullable = false, insertable = false, updatable = false)
    private UUID neuronId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "neuron_id", nullable = false)
    private Neuron neuron;

    @Column(name = "question_text", nullable = false, columnDefinition = "TEXT")
    private String questionText;

    @Column(name = "answer_text", nullable = false, columnDefinition = "TEXT")
    private String answerText;

    @Column(name = "question_order", nullable = false)
    private int questionOrder = 0;

    @Column(name = "content_hash", length = 64)
    private String contentHash;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    private ReviewQuestionStatus status = ReviewQuestionStatus.READY;

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
    public UUID getSrItemId() { return srItemId; }
    public SpacedRepetitionItem getSrItem() { return srItem; }
    public void setSrItem(SpacedRepetitionItem srItem) { this.srItem = srItem; }
    public UUID getNeuronId() { return neuronId; }
    public Neuron getNeuron() { return neuron; }
    public void setNeuron(Neuron neuron) { this.neuron = neuron; }
    public String getQuestionText() { return questionText; }
    public void setQuestionText(String questionText) { this.questionText = questionText; }
    public String getAnswerText() { return answerText; }
    public void setAnswerText(String answerText) { this.answerText = answerText; }
    public int getQuestionOrder() { return questionOrder; }
    public void setQuestionOrder(int questionOrder) { this.questionOrder = questionOrder; }
    public String getContentHash() { return contentHash; }
    public void setContentHash(String contentHash) { this.contentHash = contentHash; }
    public ReviewQuestionStatus getStatus() { return status; }
    public void setStatus(ReviewQuestionStatus status) { this.status = status; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
}
