package com.wliant.brainbook.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

public record QuestionCountRequest(
        @NotNull @Min(1) @Max(10) Integer questionCount
) {
}
