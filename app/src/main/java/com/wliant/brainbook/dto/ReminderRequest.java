package com.wliant.brainbook.dto;

import com.wliant.brainbook.model.RecurrencePattern;
import com.wliant.brainbook.model.ReminderType;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

import java.time.LocalDateTime;

public record ReminderRequest(
        @NotNull(message = "Reminder type is required")
        ReminderType reminderType,

        @NotNull(message = "Trigger time is required")
        LocalDateTime triggerAt,

        RecurrencePattern recurrencePattern,

        @Min(value = 1, message = "Recurrence interval must be at least 1")
        @Max(value = 365, message = "Recurrence interval cannot exceed 365")
        Integer recurrenceInterval,

        String title,
        String description,
        String descriptionText
) {
}
