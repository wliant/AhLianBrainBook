package com.wliant.brainbook.dto;

import jakarta.validation.constraints.NotEmpty;

import java.util.List;
import java.util.UUID;

public record ReorderRequest(
        @NotEmpty(message = "Ordered IDs list is required and cannot be empty")
        List<UUID> orderedIds
) {
}
