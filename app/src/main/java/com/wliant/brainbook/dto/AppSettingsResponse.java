package com.wliant.brainbook.dto;

import java.time.LocalDateTime;

public record AppSettingsResponse(
        String displayName,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
}
