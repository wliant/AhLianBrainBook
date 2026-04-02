package com.wliant.brainbook.service;

import com.wliant.brainbook.model.SpacedRepetitionItem;
import com.wliant.brainbook.repository.SpacedRepetitionRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;

@Service
public class ReviewQuestionSchedulerService {

    private static final Logger log = LoggerFactory.getLogger(ReviewQuestionSchedulerService.class);

    private final SpacedRepetitionRepository srRepository;
    private final ReviewQuestionService reviewQuestionService;

    public ReviewQuestionSchedulerService(SpacedRepetitionRepository srRepository,
                                           ReviewQuestionService reviewQuestionService) {
        this.srRepository = srRepository;
        this.reviewQuestionService = reviewQuestionService;
    }

    @Scheduled(fixedRateString = "${app.review-qa.scheduler.fixed-rate:300000}")
    public void generatePendingQuestions() {
        LocalDateTime horizon = LocalDateTime.now().plusHours(24);
        List<SpacedRepetitionItem> items = srRepository.findDueWithoutReadyQuestions(horizon);

        if (items.isEmpty()) {
            return;
        }

        log.info("Generating review questions for {} SR item(s)", items.size());
        int successCount = 0;
        int failureCount = 0;

        for (SpacedRepetitionItem item : items) {
            try {
                reviewQuestionService.generateQuestionsForItem(item.getId());
                successCount++;
            } catch (Exception e) {
                failureCount++;
                log.error("Failed to generate questions for SR item {} (neuron {}): {}",
                        item.getId(), item.getNeuronId(), e.getMessage(), e);
            }
        }

        if (failureCount > 0) {
            log.warn("Review Q&A generation completed: {} succeeded, {} failed", successCount, failureCount);
        } else {
            log.info("Review Q&A generation completed: {} succeeded", successCount);
        }
    }
}
