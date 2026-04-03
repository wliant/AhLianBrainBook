package com.wliant.brainbook.dto;

import java.time.LocalDateTime;
import java.util.UUID;

public record ProjectConfigResponse(
        UUID id,
        UUID clusterId,
        String repoUrl,
        String defaultBranch,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
}
