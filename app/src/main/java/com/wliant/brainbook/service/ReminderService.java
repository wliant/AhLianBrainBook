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

import java.util.Optional;
import java.util.UUID;

@Service
public class ReminderService {

    private static final Logger log = LoggerFactory.getLogger(ReminderService.class);

    private final ReminderRepository reminderRepository;
    private final NeuronRepository neuronRepository;

    public ReminderService(ReminderRepository reminderRepository, NeuronRepository neuronRepository) {
        this.reminderRepository = reminderRepository;
        this.neuronRepository = neuronRepository;
    }

    @Transactional
    public ReminderResponse create(UUID neuronId, ReminderRequest req) {
        Neuron neuron = neuronRepository.findById(neuronId)
                .orElseThrow(() -> new ResourceNotFoundException("Neuron not found: " + neuronId));

        // Upsert: reuse existing reminder or create new one
        Reminder reminder = reminderRepository.findByNeuronId(neuronId)
                .orElseGet(() -> {
                    Reminder r = new Reminder();
                    r.setNeuron(neuron);
                    return r;
                });

        applyRequest(reminder, req);
        reminder.setActive(true);

        Reminder saved = reminderRepository.save(reminder);
        log.info("Created/updated reminder {} for neuron {} (type={}, triggerAt={})",
                saved.getId(), neuronId, req.reminderType(), req.triggerAt());
        return toResponse(saved);
    }

    @Transactional(readOnly = true)
    public Optional<ReminderResponse> getByNeuronId(UUID neuronId) {
        return reminderRepository.findByNeuronId(neuronId).map(this::toResponse);
    }

    @Transactional
    public ReminderResponse update(UUID neuronId, ReminderRequest req) {
        Reminder reminder = reminderRepository.findByNeuronId(neuronId)
                .orElseThrow(() -> new ResourceNotFoundException("Reminder not found for neuron: " + neuronId));

        applyRequest(reminder, req);
        reminder.setActive(true);

        Reminder saved = reminderRepository.save(reminder);
        log.info("Updated reminder {} for neuron {} (type={}, triggerAt={})",
                saved.getId(), neuronId, req.reminderType(), req.triggerAt());
        return toResponse(saved);
    }

    @Transactional
    public void delete(UUID neuronId) {
        Reminder reminder = reminderRepository.findByNeuronId(neuronId)
                .orElseThrow(() -> new ResourceNotFoundException("Reminder not found for neuron: " + neuronId));
        reminderRepository.delete(reminder);
        log.info("Deleted reminder {} for neuron {}", reminder.getId(), neuronId);
    }

    private void applyRequest(Reminder reminder, ReminderRequest req) {
        reminder.setReminderType(req.reminderType());
        reminder.setTriggerAt(req.triggerAt());
        reminder.setRecurrencePattern(req.recurrencePattern());
        reminder.setRecurrenceInterval(req.recurrenceInterval() != null ? req.recurrenceInterval() : 1);
    }

    private ReminderResponse toResponse(Reminder reminder) {
        UUID neuronId = reminder.getNeuronId() != null
                ? reminder.getNeuronId()
                : (reminder.getNeuron() != null ? reminder.getNeuron().getId() : null);
        return new ReminderResponse(
                reminder.getId(),
                neuronId,
                reminder.getReminderType(),
                reminder.getTriggerAt(),
                reminder.getRecurrencePattern(),
                reminder.getRecurrenceInterval(),
                reminder.isActive(),
                reminder.getCreatedAt(),
                reminder.getUpdatedAt()
        );
    }
}
