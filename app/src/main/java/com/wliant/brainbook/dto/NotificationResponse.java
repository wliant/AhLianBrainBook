package com.wliant.brainbook.dto;

import java.time.LocalDateTime;
import java.util.UUID;

public record NotificationResponse(
        UUID id,
        UUID reminderId,
        UUID neuronId,
        UUID brainId,
        UUID clusterId,
        String neuronTitle,
        String message,
        boolean isRead,
        LocalDateTime createdAt
) {
}
