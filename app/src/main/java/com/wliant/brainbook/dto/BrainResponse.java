package com.wliant.brainbook.dto;

import java.time.LocalDateTime;
import java.util.UUID;

public record BrainResponse(
        UUID id,
        String name,
        String icon,
        String color,
        int sortOrder,
        boolean isArchived,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
}
