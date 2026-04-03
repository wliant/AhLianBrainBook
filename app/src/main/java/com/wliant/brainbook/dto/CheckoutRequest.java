package com.wliant.brainbook.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record CheckoutRequest(
        @NotBlank(message = "Branch name is required")
        @Size(max = 255, message = "Branch name must be at most 255 characters")
        String branch
) {
}
