package com.wliant.brainbook.dto;

import java.time.LocalDateTime;
import java.util.List;

public record SharedNeuronResponse(
        String title,
        String contentJson,
        List<TagResponse> tags,
        String brainName,
        LocalDateTime createdAt
) {
}
