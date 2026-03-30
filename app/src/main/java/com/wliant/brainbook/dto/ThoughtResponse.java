package com.wliant.brainbook.dto;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

public record ThoughtResponse(
        UUID id,
        String name,
        String description,
        String neuronTagMode,
        String brainTagMode,
        int sortOrder,
        LocalDateTime createdAt,
        LocalDateTime updatedAt,
        List<TagResponse> neuronTags,
        List<TagResponse> brainTags
) {
}
