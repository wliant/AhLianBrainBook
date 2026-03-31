package com.wliant.brainbook.dto;

import java.time.LocalDateTime;
import java.util.UUID;

public record ShareResponse(
        UUID id,
        String token,
        LocalDateTime expiresAt,
        LocalDateTime createdAt
) {
}
