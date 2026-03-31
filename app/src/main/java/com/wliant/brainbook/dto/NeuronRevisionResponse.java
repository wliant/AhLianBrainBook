package com.wliant.brainbook.dto;

import java.time.LocalDateTime;
import java.util.UUID;

public record NeuronRevisionResponse(
        UUID id,
        UUID neuronId,
        int revisionNumber,
        String title,
        String contentJson,
        String contentText,
        LocalDateTime createdAt
) {
}
