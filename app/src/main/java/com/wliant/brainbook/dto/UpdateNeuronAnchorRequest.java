package com.wliant.brainbook.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record UpdateNeuronAnchorRequest(
        @NotBlank(message = "File path is required")
        @Size(max = 1000, message = "File path must be at most 1000 characters")
        String filePath
) {
}
