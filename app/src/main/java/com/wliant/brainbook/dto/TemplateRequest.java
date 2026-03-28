package com.wliant.brainbook.dto;

public record TemplateRequest(
        String name,
        String description,
        String contentJson
) {
}
