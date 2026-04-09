package com.wliant.brainbook.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Size;

public record AppSettingsRequest(
        @Size(max = 100) String displayName,
        @Min(1) @Max(100) Integer maxRemindersPerNeuron,
        @Size(max = 50) String timezone,
        Boolean aiToolsEnabled
) {
}
