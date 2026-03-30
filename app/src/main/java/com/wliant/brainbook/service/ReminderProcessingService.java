package com.wliant.brainbook.service;

import com.wliant.brainbook.model.Neuron;
import com.wliant.brainbook.model.RecurrencePattern;
import com.wliant.brainbook.model.Reminder;
import com.wliant.brainbook.model.ReminderType;
import com.wliant.brainbook.repository.NeuronRepository;
import com.wliant.brainbook.repository.ReminderRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

@Service
public class ReminderProcessingService {

    private static final Logger log = LoggerFactory.getLogger(ReminderProcessingService.class);
    private static final int MAX_ADVANCE_ITERATIONS = 732; // ~2 years of daily

    private final ReminderRepository reminderRepository;
    private final NeuronRepository neuronRepository;
    private final NotificationService notificationService;

    public ReminderProcessingService(ReminderRepository reminderRepository,
                                      NeuronRepository neuronRepository,
                                      NotificationService notificationService) {
        this.reminderRepository = reminderRepository;
        this.neuronRepository = neuronRepository;
        this.notificationService = notificationService;
    }

    @Transactional
    public void processReminder(Reminder reminder, LocalDateTime now) {
        Neuron neuron = neuronRepository.findById(reminder.getNeuronId()).orElse(null);
        if (neuron == null || neuron.isDeleted() || neuron.isArchived()) {
            log.info("Deactivating reminder {} — neuron {} is missing/deleted/archived",
                    reminder.getId(), reminder.getNeuronId());
            reminder.setActive(false);
            reminderRepository.save(reminder);
            return;
        }

        notificationService.create(reminder, neuron);
        log.info("Created notification for reminder {} (neuron={})", reminder.getId(), neuron.getTitle());

        if (reminder.getReminderType() == ReminderType.ONCE) {
            reminderRepository.delete(reminder);
            log.debug("Deleted ONCE reminder {}", reminder.getId());
        } else if (reminder.getReminderType() == ReminderType.RECURRING) {
            LocalDateTime nextTrigger = computeNextTrigger(reminder, now);
            reminder.setTriggerAt(nextTrigger);
            reminderRepository.save(reminder);
            log.debug("Advanced RECURRING reminder {} to {}", reminder.getId(), nextTrigger);
        }
    }

    private LocalDateTime computeNextTrigger(Reminder reminder, LocalDateTime now) {
        LocalDateTime next = reminder.getTriggerAt();
        int interval = reminder.getRecurrenceInterval() != null ? reminder.getRecurrenceInterval() : 1;
        RecurrencePattern pattern = reminder.getRecurrencePattern();

        if (interval <= 0) {
            log.error("Invalid recurrence interval {} for reminder {}, defaulting to 1",
                    interval, reminder.getId());
            interval = 1;
        }

        if (pattern == null) {
            log.warn("Missing recurrence pattern for reminder {}, defaulting to DAILY", reminder.getId());
            pattern = RecurrencePattern.DAILY;
        }

        int iterations = 0;
        while (!next.isAfter(now) && iterations < MAX_ADVANCE_ITERATIONS) {
            next = switch (pattern) {
                case DAILY -> next.plusDays(interval);
                case WEEKLY -> next.plusWeeks(interval);
                case MONTHLY -> next.plusMonths(interval);
            };
            iterations++;
        }

        if (iterations >= MAX_ADVANCE_ITERATIONS) {
            log.error("Reminder {} exceeded max iterations ({}) advancing trigger_at, forcing to tomorrow",
                    reminder.getId(), MAX_ADVANCE_ITERATIONS);
            next = now.plusDays(1);
        }

        return next;
    }
}
