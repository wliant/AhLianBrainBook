package com.wliant.brainbook.dto;

import java.time.LocalDateTime;
import java.util.UUID;

public record RevisionResponse(
        UUID id,
        UUID neuronId,
        int revisionNumber,
        String contentJson,
        String contentText,
        LocalDateTime createdAt
) {
}
