package com.wliant.brainbook.dto;

import java.time.LocalDateTime;
import java.util.UUID;

public record NeuronLinkResponse(
    UUID id,
    UUID sourceNeuronId,
    String sourceNeuronTitle,
    UUID sourceNeuronClusterId,
    UUID targetNeuronId,
    String targetNeuronTitle,
    UUID targetNeuronClusterId,
    String label,
    String linkType,
    Double weight,
    String source,
    LocalDateTime createdAt
) { }
