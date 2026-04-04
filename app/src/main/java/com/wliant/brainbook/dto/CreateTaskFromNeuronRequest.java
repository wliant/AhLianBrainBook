package com.wliant.brainbook.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.UUID;

public record CreateTaskFromNeuronRequest(
        @NotNull(message = "Source neuron ID is required")
        UUID sourceNeuronId,
        @NotBlank(message = "Title is required")
        @Size(max = 500, message = "Title must be at most 500 characters")
        String title
) {
}
