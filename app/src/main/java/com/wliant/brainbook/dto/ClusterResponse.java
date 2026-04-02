package com.wliant.brainbook.dto;

import java.time.LocalDateTime;
import java.util.UUID;

public record ClusterResponse(
        UUID id,
        UUID brainId,
        String name,
        String type,
        String status,
        String researchGoal,
        int sortOrder,
        boolean isArchived,
        LocalDateTime createdAt,
        LocalDateTime updatedAt,
        String createdBy,
        String lastUpdatedBy
) {
}
