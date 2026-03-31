package com.wliant.brainbook.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

public record SpacedRepetitionReviewRequest(
        @NotNull @Min(0) @Max(5) Integer quality
) {
}
