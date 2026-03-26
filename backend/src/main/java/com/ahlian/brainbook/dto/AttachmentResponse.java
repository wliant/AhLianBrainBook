package com.ahlian.brainbook.dto;

import java.time.LocalDateTime;
import java.util.UUID;

public record AttachmentResponse(
        UUID id,
        UUID neuronId,
        String fileName,
        String filePath,
        Long fileSize,
        String contentType,
        LocalDateTime createdAt
) {
}
