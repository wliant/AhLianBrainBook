package com.wliant.brainbook.service;

import com.wliant.brainbook.dto.SpacedRepetitionItemResponse;
import com.wliant.brainbook.exception.ResourceNotFoundException;
import com.wliant.brainbook.model.Neuron;
import com.wliant.brainbook.model.SpacedRepetitionItem;
import com.wliant.brainbook.repository.NeuronRepository;
import com.wliant.brainbook.repository.SpacedRepetitionRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Service
@Transactional
public class SpacedRepetitionService {

    private final SpacedRepetitionRepository srRepository;
    private final NeuronRepository neuronRepository;

    public SpacedRepetitionService(SpacedRepetitionRepository srRepository,
                                   NeuronRepository neuronRepository) {
        this.srRepository = srRepository;
        this.neuronRepository = neuronRepository;
    }

    public SpacedRepetitionItemResponse addItem(UUID neuronId) {
        Neuron neuron = neuronRepository.findById(neuronId)
                .orElseThrow(() -> new ResourceNotFoundException("Neuron not found"));

        // Check if already exists
        var existing = srRepository.findByNeuronId(neuronId);
        if (existing.isPresent()) {
            return toResponse(existing.get());
        }

        SpacedRepetitionItem item = new SpacedRepetitionItem();
        item.setNeuron(neuron);
        item.setNextReviewAt(LocalDateTime.now());

        SpacedRepetitionItem saved = srRepository.save(item);
        return toResponse(saved);
    }

    public void removeItem(UUID neuronId) {
        srRepository.deleteByNeuronId(neuronId);
    }

    @Transactional(readOnly = true)
    public SpacedRepetitionItemResponse getItem(UUID neuronId) {
        SpacedRepetitionItem item = srRepository.findByNeuronId(neuronId)
                .orElseThrow(() -> new ResourceNotFoundException("Spaced repetition item not found"));
        return toResponse(item);
    }

    @Transactional(readOnly = true)
    public List<SpacedRepetitionItemResponse> getAllItems() {
        return srRepository.findAll().stream().map(this::toResponse).toList();
    }

    @Transactional(readOnly = true)
    public List<SpacedRepetitionItemResponse> getReviewQueue() {
        return srRepository
                .findByNextReviewAtLessThanEqualOrderByNextReviewAtAsc(LocalDateTime.now())
                .stream()
                .map(this::toResponse)
                .toList();
    }

    public SpacedRepetitionItemResponse submitReview(UUID itemId, int quality) {
        SpacedRepetitionItem item = srRepository.findById(itemId)
                .orElseThrow(() -> new ResourceNotFoundException("Spaced repetition item not found"));

        applySm2(item, quality);
        item.setLastReviewedAt(LocalDateTime.now());

        SpacedRepetitionItem saved = srRepository.save(item);
        return toResponse(saved);
    }

    /**
     * SM-2 algorithm implementation.
     * quality: 0-5 (0=complete blackout, 5=perfect recall)
     */
    private void applySm2(SpacedRepetitionItem item, int quality) {
        if (quality >= 3) {
            // Correct response
            if (item.getRepetitions() == 0) {
                item.setIntervalDays(1);
            } else if (item.getRepetitions() == 1) {
                item.setIntervalDays(6);
            } else {
                item.setIntervalDays((int) Math.round(item.getIntervalDays() * item.getEaseFactor()));
            }
            item.setRepetitions(item.getRepetitions() + 1);
        } else {
            // Incorrect response — reset
            item.setRepetitions(0);
            item.setIntervalDays(1);
        }

        // Update ease factor
        double ef = item.getEaseFactor() + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
        item.setEaseFactor(Math.max(1.3, ef));

        // Schedule next review
        item.setNextReviewAt(LocalDateTime.now().plusDays(item.getIntervalDays()));
    }

    private SpacedRepetitionItemResponse toResponse(SpacedRepetitionItem item) {
        return new SpacedRepetitionItemResponse(
                item.getId(),
                item.getNeuronId(),
                item.getNeuron().getTitle(),
                item.getEaseFactor(),
                item.getIntervalDays(),
                item.getRepetitions(),
                item.getNextReviewAt(),
                item.getLastReviewedAt(),
                item.getCreatedAt()
        );
    }
}
