package com.wliant.brainbook.dto;

import com.wliant.brainbook.model.ReviewQuestionMode;
import jakarta.validation.constraints.NotNull;

public record QuestionModeRequest(
        @NotNull ReviewQuestionMode questionMode
) {
}
