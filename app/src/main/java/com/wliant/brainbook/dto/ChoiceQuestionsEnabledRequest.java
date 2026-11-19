package com.wliant.brainbook.dto;

import jakarta.validation.constraints.NotNull;

public record ChoiceQuestionsEnabledRequest(
        @NotNull Boolean choiceQuestionsEnabled
) {
}
