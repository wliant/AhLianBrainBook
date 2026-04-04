package com.wliant.brainbook.dto;

import jakarta.annotation.Nullable;
import jakarta.validation.constraints.NotBlank;
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
        String complexity,

        @Nullable
        AnchorRequest anchor
) {
    public record AnchorRequest(
            @NotBlank(message = "File path is required")
            @Size(max = 1000, message = "File path must be at most 1000 characters")
            String filePath
    ) {
    }
}
