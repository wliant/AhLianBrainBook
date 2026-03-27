package com.ahlian.brainbook.dto;

import java.util.UUID;

public record MoveNeuronRequest(
        UUID targetClusterId,
        UUID targetBrainId
) {
}
