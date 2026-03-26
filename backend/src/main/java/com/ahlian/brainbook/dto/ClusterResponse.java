package com.ahlian.brainbook.dto;

import java.time.LocalDateTime;
import java.util.UUID;

public record ClusterResponse(
        UUID id,
        UUID brainId,
        String name,
        UUID parentClusterId,
        int sortOrder,
        boolean isArchived,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
}
