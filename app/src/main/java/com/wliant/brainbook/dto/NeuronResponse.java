package com.wliant.brainbook.dto;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

public record NeuronResponse(
        UUID id,
        UUID brainId,
        UUID clusterId,
        String title,
        String contentJson,
        String contentText,
        UUID templateId,
        int sortOrder,
        boolean isFavorite,
        boolean isPinned,
        boolean isArchived,
        boolean isDeleted,
        int version,
        LocalDateTime lastEditedAt,
        LocalDateTime createdAt,
        LocalDateTime updatedAt,
        List<TagResponse> tags
) {
}
