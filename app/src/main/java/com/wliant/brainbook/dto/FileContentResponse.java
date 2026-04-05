package com.wliant.brainbook.dto;

public record FileContentResponse(
        String path,
        String content,
        String language,
        long size,
        String encoding
) {
}
