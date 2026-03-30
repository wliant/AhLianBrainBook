package com.wliant.brainbook.dto;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

public record BrainResponse(
        UUID id,
        String name,
        String icon,
        String color,
        String description,
        int sortOrder,
        boolean isArchived,
        LocalDateTime createdAt,
        LocalDateTime updatedAt,
        List<TagResponse> tags
) {
}
