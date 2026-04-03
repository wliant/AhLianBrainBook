package com.wliant.brainbook.dto;

import jakarta.annotation.Nullable;
import jakarta.validation.constraints.Size;

public record UpdateProjectConfigRequest(
        @Nullable
        @Size(max = 255, message = "Default branch must be at most 255 characters")
        String defaultBranch
) {
}
