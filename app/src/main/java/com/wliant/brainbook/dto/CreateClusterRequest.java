package com.wliant.brainbook.dto;

import jakarta.annotation.Nullable;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.util.UUID;

public record CreateClusterRequest(
        @NotBlank(message = "Name is required")
        @Size(max = 255, message = "Name must be at most 255 characters")
        String name,

        @NotNull(message = "Brain ID is required")
        UUID brainId,

        @Nullable
        @Pattern(regexp = "knowledge|ai-research|project|todo", message = "Type must be knowledge, ai-research, project, or todo")
        String type,

        @Nullable
        @Size(max = 2000, message = "Repo URL must be at most 2000 characters")
        String repoUrl,

        @Nullable
        @Size(max = 255, message = "Default branch must be at most 255 characters")
        String defaultBranch
) {
}
