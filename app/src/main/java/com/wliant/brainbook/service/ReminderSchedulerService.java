package com.wliant.brainbook.service;

import com.wliant.brainbook.model.Reminder;
import com.wliant.brainbook.repository.ReminderRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.Clock;
import java.time.LocalDateTime;
import java.util.List;

@Service
public class ReminderSchedulerService {

    private static final Logger log = LoggerFactory.getLogger(ReminderSchedulerService.class);

    private final ReminderRepository reminderRepository;
    private final ReminderProcessingService reminderProcessingService;
    private final Clock clock;

    public ReminderSchedulerService(ReminderRepository reminderRepository,
                                     ReminderProcessingService reminderProcessingService,
                                     Clock clock) {
        this.reminderRepository = reminderRepository;
        this.reminderProcessingService = reminderProcessingService;
        this.clock = clock;
    }

    @Scheduled(fixedRateString = "${app.reminder.scheduler.fixed-rate:60000}")
    public void processReminders() {
        LocalDateTime now = LocalDateTime.now(clock);
        List<Reminder> dueReminders = reminderRepository.findByIsActiveTrueAndTriggerAtLessThanEqual(now);

        if (dueReminders.isEmpty()) {
            return;
        }

        log.info("Processing {} due reminder(s)", dueReminders.size());
        int successCount = 0;
        int failureCount = 0;

        for (Reminder reminder : dueReminders) {
            try {
                reminderProcessingService.processReminder(reminder, now);
                successCount++;
            } catch (Exception e) {
                failureCount++;
                log.error("Failed to process reminder {}: {}", reminder.getId(), e.getMessage(), e);
            }
        }

        if (failureCount > 0) {
            log.warn("Reminder processing completed: {} succeeded, {} failed", successCount, failureCount);
        } else {
            log.info("Reminder processing completed: {} succeeded", successCount);
        }
    }
}
