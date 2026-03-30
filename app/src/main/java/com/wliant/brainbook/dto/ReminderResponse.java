package com.wliant.brainbook.dto;

import com.wliant.brainbook.model.RecurrencePattern;
import com.wliant.brainbook.model.ReminderType;

import java.time.LocalDateTime;
import java.util.UUID;

public record ReminderResponse(
        UUID id,
        UUID neuronId,
        ReminderType reminderType,
        LocalDateTime triggerAt,
        RecurrencePattern recurrencePattern,
        Integer recurrenceInterval,
        boolean isActive,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
}
