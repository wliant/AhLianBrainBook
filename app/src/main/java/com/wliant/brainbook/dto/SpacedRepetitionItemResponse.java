package com.wliant.brainbook.dto;

import java.time.LocalDateTime;
import java.util.UUID;

public record SpacedRepetitionItemResponse(
        UUID id,
        UUID neuronId,
        String neuronTitle,
        double easeFactor,
        int intervalDays,
        int repetitions,
        LocalDateTime nextReviewAt,
        LocalDateTime lastReviewedAt,
        LocalDateTime createdAt,
        int questionCount,
        boolean hasQuestions,
        boolean quizEligible,
        boolean quizEnabled
) {
}
