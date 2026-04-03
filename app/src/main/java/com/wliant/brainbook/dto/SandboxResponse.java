package com.wliant.brainbook.dto;

import java.time.LocalDateTime;
import java.util.UUID;

public record SandboxResponse(
        UUID id,
        UUID clusterId,
        UUID brainId,
        String brainName,
        String clusterName,
        String repoUrl,
        String currentBranch,
        String currentCommit,
        boolean isShallow,
        String status,
        Long diskUsageBytes,
        String errorMessage,
        LocalDateTime lastAccessedAt,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
}
