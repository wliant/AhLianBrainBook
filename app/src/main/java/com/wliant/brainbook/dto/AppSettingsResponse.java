package com.wliant.brainbook.dto;

import java.time.LocalDateTime;
import java.util.UUID;

public record AppSettingsResponse(
        String displayName,
        int maxRemindersPerNeuron,
        String timezone,
        boolean aiToolsEnabled,
        UUID defaultShareClusterId,
        UUID defaultShareBrainId,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
}
