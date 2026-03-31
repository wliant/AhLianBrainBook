package com.wliant.brainbook.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.UUID;

public record NeuronLinkRequest(
    @NotNull(message = "Source neuron ID is required")
    UUID sourceNeuronId,

    @NotNull(message = "Target neuron ID is required")
    UUID targetNeuronId,

    @Size(max = 255, message = "Label must be at most 255 characters")
    String label,

    @Size(max = 50, message = "Link type must be at most 50 characters")
    String linkType,

    Double weight,

    @Size(max = 20, message = "Source must be at most 20 characters")
    String source
) { }
