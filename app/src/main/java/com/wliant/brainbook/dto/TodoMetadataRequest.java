package com.wliant.brainbook.dto;

import jakarta.annotation.Nullable;
import jakarta.validation.constraints.Pattern;

import java.time.LocalDate;

public record TodoMetadataRequest(
        @Nullable LocalDate dueDate,
        @Nullable Boolean completed,
        @Nullable @Pattern(regexp = "15min|30min|1hr|2hr|4hr|8hr", message = "Effort must be one of: 15min, 30min, 1hr, 2hr, 4hr, 8hr")
        String effort,
        @Nullable @Pattern(regexp = "critical|important|normal", message = "Priority must be one of: critical, important, normal")
        String priority
) {
}
