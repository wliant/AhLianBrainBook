package com.wliant.brainbook.dto;

import jakarta.validation.constraints.Size;

import java.util.UUID;

public record NeuronRequest(
        @Size(max = 500, message = "Title must be at most 500 characters")
        String title,

        UUID brainId,
        UUID clusterId,
        String contentJson,
        String contentText,
        UUID templateId,

        @Size(max = 20, message = "Complexity must be at most 20 characters")
        String complexity
) {
}
