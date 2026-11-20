package com.wliant.brainbook.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

/**
 * The bounds here are a sanity check only — the exact allowed set lives in
 * {@code SpacedRepetitionService.ALLOWED_QUESTION_COUNTS} so the rejection can name it.
 */
public record QuestionCountRequest(
        @NotNull @Min(5) @Max(50) Integer questionCount
) {
}
