package com.wliant.brainbook.service;

import com.wliant.brainbook.dto.ReminderRequest;
import com.wliant.brainbook.dto.ReminderResponse;
import com.wliant.brainbook.exception.ResourceNotFoundException;
import com.wliant.brainbook.model.Neuron;
import com.wliant.brainbook.model.Reminder;
import com.wliant.brainbook.repository.NeuronRepository;
import com.wliant.brainbook.repository.ReminderRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Service
public class ReminderService {

    private static final Logger log = LoggerFactory.getLogger(ReminderService.class);

    private final ReminderRepository reminderRepository;
    private final NeuronRepository neuronRepository;
    private final SettingsService settingsService;
    private final Clock clock;

    public ReminderService(ReminderRepository reminderRepository, NeuronRepository neuronRepository,
                           SettingsService settingsService, Clock clock) {
        this.reminderRepository = reminderRepository;
        this.neuronRepository = neuronRepository;
        this.settingsService = settingsService;
        this.clock = clock;
    }

    @Transactional
    public ReminderResponse create(UUID neuronId, ReminderRequest req) {
        Neuron neuron = neuronRepository.findById(neuronId)
                .orElseThrow(() -> new ResourceNotFoundException("Neuron not found: " + neuronId));

        int maxReminders = settingsService.getMaxRemindersPerNeuron();
        long currentCount = reminderRepository.countByNeuronId(neuronId);
        if (currentCount >= maxReminders) {
            throw new IllegalStateException(
                    "Maximum number of reminders (" + maxReminders + ") reached for this neuron");
        }

        Reminder reminder = new Reminder();
        reminder.setNeuron(neuron);
        applyRequest(reminder, req);
        reminder.setActive(true);

        Reminder saved = reminderRepository.save(reminder);
        log.info("Created reminder {} for neuron {} (type={}, triggerAt={})",
                saved.getId(), neuronId, req.reminderType(), req.triggerAt());
        return toResponse(saved);
    }

    @Transactional(readOnly = true)
    public List<ReminderResponse> listByNeuronId(UUID neuronId) {
        return reminderRepository.findByNeuronIdOrderByCreatedAtDesc(neuronId)
                .stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<ReminderResponse> listAll() {
        return reminderRepository.findAllActiveWithNeuronOrderByTriggerAtAsc()
                .stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional
    public ReminderResponse update(UUID reminderId, ReminderRequest req) {
        Reminder reminder = reminderRepository.findById(reminderId)
                .orElseThrow(() -> new ResourceNotFoundException("Reminder not found: " + reminderId));

        applyRequest(reminder, req);
        reminder.setActive(true);

        Reminder saved = reminderRepository.save(reminder);
        log.info("Updated reminder {} (type={}, triggerAt={})",
                saved.getId(), req.reminderType(), req.triggerAt());
        return toResponse(saved);
    }

    @Transactional
    public void delete(UUID reminderId) {
        Reminder reminder = reminderRepository.findById(reminderId)
                .orElseThrow(() -> new ResourceNotFoundException("Reminder not found: " + reminderId));
        reminderRepository.delete(reminder);
        log.info("Deleted reminder {}", reminderId);
    }

    private void applyRequest(Reminder reminder, ReminderRequest req) {
        if (req.triggerAt().isBefore(LocalDateTime.now(clock))) {
            throw new IllegalArgumentException("Reminder trigger time must be in the future");
        }
        reminder.setReminderType(req.reminderType());
        reminder.setTriggerAt(req.triggerAt());
        reminder.setRecurrencePattern(req.recurrencePattern());
        reminder.setRecurrenceInterval(req.recurrenceInterval() != null ? req.recurrenceInterval() : 1);
        reminder.setTitle(req.title());
        reminder.setDescription(req.description());
        reminder.setDescriptionText(req.descriptionText());
    }

    private ReminderResponse toResponse(Reminder reminder) {
        UUID neuronId = reminder.getNeuronId() != null
                ? reminder.getNeuronId()
                : (reminder.getNeuron() != null ? reminder.getNeuron().getId() : null);
        String neuronTitle = reminder.getNeuron() != null ? reminder.getNeuron().getTitle() : null;
        return new ReminderResponse(
                reminder.getId(),
                neuronId,
                reminder.getReminderType(),
                reminder.getTriggerAt(),
                reminder.getRecurrencePattern(),
                reminder.getRecurrenceInterval(),
                reminder.isActive(),
                reminder.getCreatedAt(),
                reminder.getUpdatedAt(),
                reminder.getTitle(),
                reminder.getDescription(),
                reminder.getDescriptionText(),
                neuronTitle
        );
    }
}
