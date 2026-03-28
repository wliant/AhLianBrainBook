package com.wliant.brainbook.dto;

import java.time.LocalDateTime;
import java.util.UUID;

public record TemplateResponse(
        UUID id,
        String name,
        String description,
        String contentJson,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
}
