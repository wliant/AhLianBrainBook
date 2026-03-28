package com.wliant.brainbook.dto;

import jakarta.validation.constraints.NotNull;

import java.util.UUID;

public record MoveNeuronRequest(
        @NotNull(message = "Target cluster ID is required")
        UUID targetClusterId,

        @NotNull(message = "Target brain ID is required")
        UUID targetBrainId
) {
}
