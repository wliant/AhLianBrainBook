package com.wliant.brainbook.service;

import com.wliant.brainbook.dto.SpacedRepetitionItemResponse;
import com.wliant.brainbook.exception.ResourceNotFoundException;
import com.wliant.brainbook.model.Neuron;
import com.wliant.brainbook.model.SpacedRepetitionItem;
import com.wliant.brainbook.repository.NeuronRepository;
import com.wliant.brainbook.repository.SpacedRepetitionRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Service
@Transactional
public class SpacedRepetitionService {

    private static final Logger log = LoggerFactory.getLogger(SpacedRepetitionService.class);

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

        var existing = srRepository.findByNeuronId(neuronId);
        if (existing.isPresent()) {
            log.debug("Neuron {} already in spaced repetition, returning existing item", neuronId);
            return toResponse(existing.get());
        }

        SpacedRepetitionItem item = new SpacedRepetitionItem();
        item.setNeuron(neuron);
        item.setNextReviewAt(LocalDateTime.now());

        SpacedRepetitionItem saved = srRepository.save(item);
        log.info("Added neuron {} ('{}') to spaced repetition", neuronId, neuron.getTitle());
        return toResponse(saved);
    }

    public void removeItem(UUID neuronId) {
        srRepository.deleteByNeuronId(neuronId);
        log.info("Removed neuron {} from spaced repetition", neuronId);
    }

    @Transactional(readOnly = true)
    public SpacedRepetitionItemResponse getItem(UUID neuronId) {
        SpacedRepetitionItem item = srRepository.findByNeuronId(neuronId)
                .orElseThrow(() -> new ResourceNotFoundException("Spaced repetition item not found"));
        return toResponse(item);
    }

    @Transactional(readOnly = true)
    public List<SpacedRepetitionItemResponse> getAllItems() {
        return srRepository.findAllWithNeuron().stream().map(this::toResponse).toList();
    }

    @Transactional(readOnly = true)
    public List<SpacedRepetitionItemResponse> getReviewQueue() {
        return srRepository
                .findDueForReviewWithNeuron(LocalDateTime.now())
                .stream()
                .map(this::toResponse)
                .toList();
    }

    public SpacedRepetitionItemResponse submitReview(UUID itemId, int quality) {
        SpacedRepetitionItem item = srRepository.findById(itemId)
                .orElseThrow(() -> new ResourceNotFoundException("Spaced repetition item not found"));

        LocalDateTime now = LocalDateTime.now();
        applySm2(item, quality, now);
        item.setLastReviewedAt(now);

        SpacedRepetitionItem saved = srRepository.save(item);
        log.info("Review submitted for item {} (neuron {}): quality={}, nextInterval={}d, ef={}",
                itemId, item.getNeuronId(), quality, item.getIntervalDays(), item.getEaseFactor());
        return toResponse(saved);
    }

    /**
     * SM-2 algorithm implementation.
     *
     * @param item    the spaced repetition item to update
     * @param quality 0-5 (0=complete blackout, 5=perfect recall)
     * @param now     current time, passed explicitly for testability
     */
    void applySm2(SpacedRepetitionItem item, int quality, LocalDateTime now) {
        if (quality >= 3) {
            if (item.getRepetitions() == 0) {
                item.setIntervalDays(1);
            } else if (item.getRepetitions() == 1) {
                item.setIntervalDays(6);
            } else {
                item.setIntervalDays((int) Math.round(item.getIntervalDays() * item.getEaseFactor()));
            }
            item.setRepetitions(item.getRepetitions() + 1);
        } else {
            item.setRepetitions(0);
            item.setIntervalDays(1);
        }

        double ef = item.getEaseFactor() + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
        item.setEaseFactor(Math.max(1.3, ef));

        item.setNextReviewAt(now.plusDays(item.getIntervalDays()));
        log.debug("SM-2: quality={}, reps={}, interval={}d, ef={}", quality,
                item.getRepetitions(), item.getIntervalDays(), item.getEaseFactor());
    }

    private SpacedRepetitionItemResponse toResponse(SpacedRepetitionItem item) {
        return new SpacedRepetitionItemResponse(
                item.getId(),
                item.getNeuron().getId(),
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
