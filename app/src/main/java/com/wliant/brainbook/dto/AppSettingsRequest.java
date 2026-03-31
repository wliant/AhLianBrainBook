package com.wliant.brainbook.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record AppSettingsRequest(
        @NotBlank @Size(max = 100) String displayName
) {
}
