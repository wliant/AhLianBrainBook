package com.wliant.brainbook.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record BrainRequest(
        @NotBlank(message = "Name is required")
        @Size(max = 255, message = "Name must be at most 255 characters")
        String name,

        @Size(max = 50, message = "Icon must be at most 50 characters")
        String icon,

        @Size(max = 20, message = "Color must be at most 20 characters")
        String color,

        @Size(max = 5000, message = "Description must be at most 5000 characters")
        String description
) {
}
