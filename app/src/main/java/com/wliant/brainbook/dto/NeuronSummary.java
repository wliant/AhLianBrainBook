package com.wliant.brainbook.dto;

import java.util.UUID;

public record NeuronSummary(
        UUID id,
        String title,
        UUID brainId,
        UUID clusterId
) {
}
