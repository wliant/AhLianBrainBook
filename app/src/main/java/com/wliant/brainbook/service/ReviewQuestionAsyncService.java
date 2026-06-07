package com.wliant.brainbook.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.util.UUID;

/**
 * Off-thread regeneration of spaced-repetition review questions.
 *
 * <p>Kept as a separate bean (not a method on {@link ReviewQuestionService}) so the
 * {@code @Async} call is proxied: an {@code @Async} method invoking
 * {@link ReviewQuestionService#generateQuestionsForItem} on the same bean would be a
 * self-invocation and bypass that method's {@code NOT_SUPPORTED} transaction semantics.
 */
@Service
public class ReviewQuestionAsyncService {

    private static final Logger log = LoggerFactory.getLogger(ReviewQuestionAsyncService.class);

    private final ReviewQuestionService reviewQuestionService;

    public ReviewQuestionAsyncService(ReviewQuestionService reviewQuestionService) {
        this.reviewQuestionService = reviewQuestionService;
    }

    /**
     * Force a fresh set of questions for one SR item, regardless of whether the item is due.
     *
     * <p>{@code markStaleByNeuron} commits in its own transaction before generation begins, so the
     * idempotency guard in {@code generateQuestionsForItem} sees no READY questions and rebuilds
     * them even when the note content is unchanged.
     */
    @Async("aiTaskExecutor")
    public void regenerateForItem(UUID srItemId, UUID neuronId) {
        try {
            reviewQuestionService.markStaleByNeuron(neuronId, "");
            reviewQuestionService.generateQuestionsForItem(srItemId);
        } catch (Exception e) {
            log.error("Async regenerate failed for SR item {} (neuron {})", srItemId, neuronId, e);
        }
    }
}
