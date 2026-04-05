package com.wliant.brainbook.service;

import com.wliant.brainbook.model.Reminder;
import com.wliant.brainbook.model.ReminderType;
import com.wliant.brainbook.repository.ReminderRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.List;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ReminderSchedulerServiceTest {

    @Mock
    private ReminderRepository reminderRepository;

    @Mock
    private ReminderProcessingService reminderProcessingService;

    private ReminderSchedulerService scheduler;
    private Clock clock;

    @BeforeEach
    void setUp() {
        clock = Clock.fixed(Instant.parse("2025-06-15T10:00:00Z"), ZoneId.of("UTC"));
        scheduler = new ReminderSchedulerService(reminderRepository, reminderProcessingService, clock);
    }

    @Test
    void processReminders_noDue_noProcessing() {
        when(reminderRepository.findByIsActiveTrueAndTriggerAtLessThanEqual(any()))
                .thenReturn(List.of());

        scheduler.processReminders();

        verifyNoInteractions(reminderProcessingService);
    }

    @Test
    void processReminders_oneDue_processedOnce() {
        Reminder reminder = createReminder();
        when(reminderRepository.findByIsActiveTrueAndTriggerAtLessThanEqual(any()))
                .thenReturn(List.of(reminder));

        scheduler.processReminders();

        verify(reminderProcessingService).processReminder(eq(reminder), any(LocalDateTime.class));
    }

    @Test
    void processReminders_exceptionOnOne_continuesOthers() {
        Reminder r1 = createReminder();
        Reminder r2 = createReminder();
        when(reminderRepository.findByIsActiveTrueAndTriggerAtLessThanEqual(any()))
                .thenReturn(List.of(r1, r2));
        doThrow(new RuntimeException("boom")).when(reminderProcessingService)
                .processReminder(eq(r1), any(LocalDateTime.class));

        scheduler.processReminders();

        verify(reminderProcessingService).processReminder(eq(r2), any(LocalDateTime.class));
    }

    @Test
    void processReminders_usesClockForNow() {
        when(reminderRepository.findByIsActiveTrueAndTriggerAtLessThanEqual(any()))
                .thenReturn(List.of());
        LocalDateTime expectedNow = LocalDateTime.now(clock);

        scheduler.processReminders();

        verify(reminderRepository).findByIsActiveTrueAndTriggerAtLessThanEqual(expectedNow);
    }

    private Reminder createReminder() {
        Reminder r = new Reminder();
        r.setId(UUID.randomUUID());
        r.setNeuronId(UUID.randomUUID());
        r.setReminderType(ReminderType.ONCE);
        r.setTriggerAt(LocalDateTime.now(clock).minusHours(1));
        r.setActive(true);
        return r;
    }
}
