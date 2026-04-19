package com.wliant.brainbook.dto;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

public record TaskOverviewItem(
        UUID neuronId,
        String title,
        LocalDate dueDate,
        boolean completed,
        LocalDateTime completedAt,
        String effort,
        String priority,
        UUID brainId,
        String brainName,
        String brainColor,
        String brainIcon,
        UUID clusterId,
        String clusterName,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
}
