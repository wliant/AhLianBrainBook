package com.wliant.brainbook.dto;

import java.time.LocalDateTime;
import java.util.Map;
import java.util.UUID;

public record ResearchTopicResponse(
        UUID id,
        UUID clusterId,
        UUID brainId,
        String title,
        String prompt,
        Map<String, Object> contentJson,
        String overallCompleteness,
        LocalDateTime lastRefreshedAt,
        int sortOrder,
        LocalDateTime createdAt,
        LocalDateTime updatedAt,
        String createdBy,
        String lastUpdatedBy
) {
}
