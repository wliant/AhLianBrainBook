package com.wliant.brainbook.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Size;

public record AppSettingsRequest(
        @Size(max = 100) String displayName,
        @Size(max = 20) String editorMode,
        @Min(1) @Max(100) Integer maxRemindersPerNeuron
) {
}
