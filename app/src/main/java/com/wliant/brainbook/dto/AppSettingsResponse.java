package com.wliant.brainbook.dto;

import java.time.LocalDateTime;

public record AppSettingsResponse(
        String displayName,
        int maxRemindersPerNeuron,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
}
