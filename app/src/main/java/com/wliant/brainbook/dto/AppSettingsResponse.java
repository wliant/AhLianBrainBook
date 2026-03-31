package com.wliant.brainbook.dto;

import java.time.LocalDateTime;

public record AppSettingsResponse(
        String displayName,
        String editorMode,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
}
