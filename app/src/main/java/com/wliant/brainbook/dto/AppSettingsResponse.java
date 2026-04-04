package com.wliant.brainbook.dto;

import java.time.LocalDateTime;

public record AppSettingsResponse(
        String displayName,
        int maxRemindersPerNeuron,
        String timezone,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
}
