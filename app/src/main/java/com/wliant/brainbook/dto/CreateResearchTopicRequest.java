package com.wliant.brainbook.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record CreateResearchTopicRequest(
        @NotBlank(message = "Prompt is required")
        @Size(max = 1000, message = "Prompt must be at most 1000 characters")
        String prompt
) {
}
