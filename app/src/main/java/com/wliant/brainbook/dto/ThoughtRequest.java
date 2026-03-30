package com.wliant.brainbook.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.util.List;
import java.util.UUID;

public record ThoughtRequest(
        @NotBlank(message = "Name is required")
        @Size(max = 255, message = "Name must be at most 255 characters")
        String name,

        @Size(max = 5000, message = "Description must be at most 5000 characters")
        String description,

        @Pattern(regexp = "any|all", message = "neuronTagMode must be 'any' or 'all'")
        String neuronTagMode,

        @Pattern(regexp = "any|all", message = "brainTagMode must be 'any' or 'all'")
        String brainTagMode,

        @NotEmpty(message = "At least one neuron tag is required")
        List<UUID> neuronTagIds,

        List<UUID> brainTagIds
) {
}
