package com.wliant.brainbook.service;

import com.wliant.brainbook.model.Neuron;
import com.wliant.brainbook.model.RecurrencePattern;
import com.wliant.brainbook.model.Reminder;
import com.wliant.brainbook.model.ReminderType;
import com.wliant.brainbook.model.TodoMetadata;
import com.wliant.brainbook.repository.ReminderRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;

@Service
public class TodoReminderService {

    private static final Logger log = LoggerFactory.getLogger(TodoReminderService.class);
    private static final LocalTime REMINDER_TIME = LocalTime.of(19, 0);

    private final ReminderRepository reminderRepository;
    private final SettingsService settingsService;

    public TodoReminderService(ReminderRepository reminderRepository, SettingsService settingsService) {
        this.reminderRepository = reminderRepository;
        this.settingsService = settingsService;
    }

    @Transactional
    public void syncSystemReminder(Neuron neuron, TodoMetadata metadata) {
        var existing = reminderRepository.findByNeuronIdAndIsSystemTrueAndIsActiveTrue(neuron.getId());

        // Deactivate if no due date or completed
        if (metadata.getDueDate() == null || metadata.isCompleted()) {
            existing.ifPresent(r -> {
                r.setActive(false);
                reminderRepository.save(r);
                log.info("Deactivated system reminder {} for neuron {}", r.getId(), neuron.getId());
            });
            return;
        }

        LocalDateTime triggerAt = computeNextTrigger(metadata.getDueDate());

        if (existing.isPresent()) {
            Reminder r = existing.get();
            r.setTriggerAt(triggerAt);
            r.setActive(true);
            r.setTitle("Task due: " + (neuron.getTitle() != null ? neuron.getTitle() : "Untitled"));
            reminderRepository.save(r);
            log.info("Updated system reminder {} triggerAt={}", r.getId(), triggerAt);
        } else {
            Reminder r = new Reminder();
            r.setNeuron(neuron);
            r.setSystem(true);
            r.setReminderType(ReminderType.RECURRING);
            r.setRecurrencePattern(RecurrencePattern.DAILY);
            r.setRecurrenceInterval(1);
            r.setActive(true);
            r.setTriggerAt(triggerAt);
            r.setTitle("Task due: " + (neuron.getTitle() != null ? neuron.getTitle() : "Untitled"));
            reminderRepository.save(r);
            log.info("Created system reminder for neuron {} triggerAt={}", neuron.getId(), triggerAt);
        }
    }

    private LocalDateTime computeNextTrigger(LocalDate dueDate) {
        String tz = settingsService.getTimezone();
        ZoneId zone = ZoneId.of(tz);
        ZonedDateTime now = ZonedDateTime.now(zone);

        // Start from the due date at 7pm local. If that's already passed, use today/tomorrow.
        ZonedDateTime candidate = dueDate.atTime(REMINDER_TIME).atZone(zone);
        if (candidate.isBefore(now)) {
            // Due date is past — use today at 7pm, or tomorrow if already past 7pm
            candidate = now.toLocalDate().atTime(REMINDER_TIME).atZone(zone);
            if (candidate.isBefore(now)) {
                candidate = candidate.plusDays(1);
            }
        }

        // Convert to UTC LocalDateTime for storage (DB uses TIMESTAMPTZ, JPA stores as UTC)
        return candidate.withZoneSameInstant(ZoneId.of("UTC")).toLocalDateTime();
    }
}
