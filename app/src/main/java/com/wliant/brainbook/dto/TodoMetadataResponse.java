package com.wliant.brainbook.dto;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

public record TodoMetadataResponse(
        UUID neuronId,
        LocalDate dueDate,
        boolean completed,
        LocalDateTime completedAt,
        String effort,
        String priority,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
}
