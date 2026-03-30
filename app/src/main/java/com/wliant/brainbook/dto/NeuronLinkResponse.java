package com.wliant.brainbook.dto;

import java.time.LocalDateTime;
import java.util.UUID;

public record NeuronLinkResponse(
    UUID id,
    UUID sourceNeuronId,
    String sourceNeuronTitle,
    UUID targetNeuronId,
    String targetNeuronTitle,
    String label,
    String linkType,
    Double weight,
    LocalDateTime createdAt
) { }
