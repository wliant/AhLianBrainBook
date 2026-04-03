package com.wliant.brainbook.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.UUID;

public record CreateNeuronAnchorRequest(
        @NotNull(message = "Neuron ID is required")
        UUID neuronId,

        @NotNull(message = "Cluster ID is required")
        UUID clusterId,

        @NotBlank(message = "File path is required")
        @Size(max = 1000, message = "File path must be at most 1000 characters")
        String filePath,

        @Min(value = 1, message = "Start line must be at least 1")
        int startLine,

        @Min(value = 1, message = "End line must be at least 1")
        int endLine
) {
}
