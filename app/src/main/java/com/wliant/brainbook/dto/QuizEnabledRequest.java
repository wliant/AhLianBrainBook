package com.wliant.brainbook.dto;

import jakarta.validation.constraints.NotNull;

public record QuizEnabledRequest(
        @NotNull Boolean quizEnabled
) {
}
