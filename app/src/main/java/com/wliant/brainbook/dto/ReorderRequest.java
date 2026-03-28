package com.wliant.brainbook.dto;

import jakarta.validation.constraints.NotNull;

import java.util.List;
import java.util.UUID;

public record ReorderRequest(
        @NotNull(message = "Ordered IDs list is required")
        List<UUID> orderedIds
) {
}
