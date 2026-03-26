package com.ahlian.brainbook.dto;

import java.util.UUID;

public record ClusterRequest(
        String name,
        UUID brainId,
        UUID parentClusterId
) {
}
