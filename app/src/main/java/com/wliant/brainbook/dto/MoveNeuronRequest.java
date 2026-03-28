package com.wliant.brainbook.dto;

import java.util.UUID;

public record MoveNeuronRequest(
        UUID targetClusterId,
        UUID targetBrainId
) {
}
