package com.wliant.brainbook.dto;

import java.util.UUID;

public record CreateTaskFromNeuronResponse(
        NeuronResponse neuron,
        TodoMetadataResponse todoMetadata,
        UUID clusterId,
        UUID brainId
) {
}
