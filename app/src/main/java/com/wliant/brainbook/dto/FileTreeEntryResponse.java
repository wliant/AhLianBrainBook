package com.wliant.brainbook.dto;

public record FileTreeEntryResponse(
        String name,
        String path,
        String type,
        Long size
) {
}
