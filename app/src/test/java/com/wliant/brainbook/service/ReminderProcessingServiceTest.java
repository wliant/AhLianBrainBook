package com.wliant.brainbook.service;

import com.wliant.brainbook.model.*;
import com.wliant.brainbook.repository.NeuronRepository;
import com.wliant.brainbook.repository.ReminderRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ReminderProcessingServiceTest {

    @Mock
    private ReminderRepository reminderRepository;

    @Mock
    private NeuronRepository neuronRepository;

    @Mock
    private NotificationService notificationService;

    private ReminderProcessingService service;
    private LocalDateTime now;

    @BeforeEach
    void setUp() {
        service = new ReminderProcessingService(reminderRepository, neuronRepository, notificationService);
        now = LocalDateTime.of(2025, 6, 15, 10, 0, 0);
    }

    @Test
    void processOnce_activeNeuron_createsNotification_deletesReminder() {
        Neuron neuron = createNeuron(false, false);
        Reminder reminder = createReminder(ReminderType.ONCE, now.minusHours(1));
        when(neuronRepository.findById(reminder.getNeuronId())).thenReturn(Optional.of(neuron));

        service.processReminder(reminder, now);

        verify(notificationService).create(reminder, neuron);
        verify(reminderRepository).delete(reminder);
    }

    @Test
    void processOnce_deletedNeuron_deactivates() {
        Neuron neuron = createNeuron(true, false);
        Reminder reminder = createReminder(ReminderType.ONCE, now.minusHours(1));
        when(neuronRepository.findById(reminder.getNeuronId())).thenReturn(Optional.of(neuron));

        service.processReminder(reminder, now);

        verify(notificationService, never()).create(any(), any());
        ArgumentCaptor<Reminder> captor = ArgumentCaptor.forClass(Reminder.class);
        verify(reminderRepository).save(captor.capture());
        assertThat(captor.getValue().isActive()).isFalse();
    }

    @Test
    void processOnce_archivedNeuron_deactivates() {
        Neuron neuron = createNeuron(false, true);
        Reminder reminder = createReminder(ReminderType.ONCE, now.minusHours(1));
        when(neuronRepository.findById(reminder.getNeuronId())).thenReturn(Optional.of(neuron));

        service.processReminder(reminder, now);

        verify(notificationService, never()).create(any(), any());
        verify(reminderRepository).save(any());
    }

    @Test
    void processOnce_neuronNotFound_deactivates() {
        Reminder reminder = createReminder(ReminderType.ONCE, now.minusHours(1));
        when(neuronRepository.findById(reminder.getNeuronId())).thenReturn(Optional.empty());

        service.processReminder(reminder, now);

        verify(notificationService, never()).create(any(), any());
        verify(reminderRepository).save(any());
    }

    @Test
    void processRecurring_advancesTriggerAt_daily() {
        Neuron neuron = createNeuron(false, false);
        Reminder reminder = createRecurringReminder(RecurrencePattern.DAILY, 1, now.minusHours(1));
        when(neuronRepository.findById(reminder.getNeuronId())).thenReturn(Optional.of(neuron));

        service.processReminder(reminder, now);

        verify(notificationService).create(reminder, neuron);
        ArgumentCaptor<Reminder> captor = ArgumentCaptor.forClass(Reminder.class);
        verify(reminderRepository).save(captor.capture());
        assertThat(captor.getValue().getTriggerAt()).isAfter(now);
    }

    @Test
    void processRecurring_advancesTriggerAt_weekly() {
        Neuron neuron = createNeuron(false, false);
        LocalDateTime triggerAt = now.minusDays(1);
        Reminder reminder = createRecurringReminder(RecurrencePattern.WEEKLY, 1, triggerAt);
        when(neuronRepository.findById(reminder.getNeuronId())).thenReturn(Optional.of(neuron));

        service.processReminder(reminder, now);

        ArgumentCaptor<Reminder> captor = ArgumentCaptor.forClass(Reminder.class);
        verify(reminderRepository).save(captor.capture());
        assertThat(captor.getValue().getTriggerAt()).isEqualTo(triggerAt.plusWeeks(1));
    }

    @Test
    void processRecurring_advancesTriggerAt_monthly() {
        Neuron neuron = createNeuron(false, false);
        LocalDateTime triggerAt = now.minusDays(1);
        Reminder reminder = createRecurringReminder(RecurrencePattern.MONTHLY, 1, triggerAt);
        when(neuronRepository.findById(reminder.getNeuronId())).thenReturn(Optional.of(neuron));

        service.processReminder(reminder, now);

        ArgumentCaptor<Reminder> captor = ArgumentCaptor.forClass(Reminder.class);
        verify(reminderRepository).save(captor.capture());
        assertThat(captor.getValue().getTriggerAt()).isEqualTo(triggerAt.plusMonths(1));
    }

    @Test
    void processRecurring_nullPattern_defaultsDaily() {
        Neuron neuron = createNeuron(false, false);
        Reminder reminder = createRecurringReminder(null, 1, now.minusHours(1));
        when(neuronRepository.findById(reminder.getNeuronId())).thenReturn(Optional.of(neuron));

        service.processReminder(reminder, now);

        ArgumentCaptor<Reminder> captor = ArgumentCaptor.forClass(Reminder.class);
        verify(reminderRepository).save(captor.capture());
        assertThat(captor.getValue().getTriggerAt()).isAfter(now);
    }

    @Test
    void processRecurring_nullInterval_defaultsOne() {
        Neuron neuron = createNeuron(false, false);
        Reminder reminder = createRecurringReminder(RecurrencePattern.DAILY, null, now.minusHours(1));
        when(neuronRepository.findById(reminder.getNeuronId())).thenReturn(Optional.of(neuron));

        service.processReminder(reminder, now);

        ArgumentCaptor<Reminder> captor = ArgumentCaptor.forClass(Reminder.class);
        verify(reminderRepository).save(captor.capture());
        assertThat(captor.getValue().getTriggerAt()).isAfter(now);
    }

    private Neuron createNeuron(boolean deleted, boolean archived) {
        Neuron n = new Neuron();
        n.setId(UUID.randomUUID());
        n.setTitle("Test Neuron");
        n.setDeleted(deleted);
        n.setArchived(archived);
        return n;
    }

    private Reminder createReminder(ReminderType type, LocalDateTime triggerAt) {
        Reminder r = new Reminder();
        r.setId(UUID.randomUUID());
        r.setNeuronId(UUID.randomUUID());
        r.setReminderType(type);
        r.setTriggerAt(triggerAt);
        r.setActive(true);
        return r;
    }

    private Reminder createRecurringReminder(RecurrencePattern pattern, Integer interval, LocalDateTime triggerAt) {
        Reminder r = createReminder(ReminderType.RECURRING, triggerAt);
        r.setRecurrencePattern(pattern);
        r.setRecurrenceInterval(interval);
        return r;
    }
}
