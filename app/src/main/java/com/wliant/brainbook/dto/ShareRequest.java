package com.wliant.brainbook.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;

public record ShareRequest(
        @Min(value = 1, message = "Expiration must be at least 1 hour")
        @Max(value = 8760, message = "Expiration cannot exceed 1 year (8760 hours)")
        Integer expiresInHours
) {
}
