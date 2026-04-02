package com.wliant.brainbook.dto;

import jakarta.annotation.Nullable;
import jakarta.validation.constraints.Size;

public record CreateResearchTopicRequest(
        @Nullable
        @Size(max = 1000, message = "Prompt must be at most 1000 characters")
        String prompt
) {
}
