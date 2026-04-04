package com.wliant.brainbook.dto;

import java.time.LocalDateTime;
import java.util.UUID;

public record NeuronAnchorResponse(
        UUID id,
        UUID neuronId,
        UUID clusterId,
        String filePath,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
}
