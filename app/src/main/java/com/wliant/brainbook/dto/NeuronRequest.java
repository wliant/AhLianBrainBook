package com.wliant.brainbook.dto;

import java.util.UUID;

public record NeuronRequest(
        String title,
        UUID brainId,
        UUID clusterId,
        String contentJson,
        String contentText,
        UUID templateId
) {
}
