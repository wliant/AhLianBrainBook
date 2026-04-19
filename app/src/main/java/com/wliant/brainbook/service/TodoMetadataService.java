package com.wliant.brainbook.service;

import com.wliant.brainbook.config.TimeProvider;
import com.wliant.brainbook.dto.TaskOverviewItem;
import com.wliant.brainbook.dto.TodoMetadataRequest;
import com.wliant.brainbook.dto.TodoMetadataResponse;
import com.wliant.brainbook.exception.ResourceNotFoundException;
import com.wliant.brainbook.model.Brain;
import com.wliant.brainbook.model.Cluster;
import com.wliant.brainbook.model.Neuron;
import com.wliant.brainbook.model.TodoEffort;
import com.wliant.brainbook.model.TodoMetadata;
import com.wliant.brainbook.model.TodoPriority;
import com.wliant.brainbook.repository.NeuronRepository;
import com.wliant.brainbook.repository.TodoMetadataRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class TodoMetadataService {

    private static final Logger log = LoggerFactory.getLogger(TodoMetadataService.class);

    private final TodoMetadataRepository todoMetadataRepository;
    private final NeuronRepository neuronRepository;
    private final TodoReminderService todoReminderService;

    public TodoMetadataService(TodoMetadataRepository todoMetadataRepository,
                                NeuronRepository neuronRepository,
                                TodoReminderService todoReminderService) {
        this.todoMetadataRepository = todoMetadataRepository;
        this.neuronRepository = neuronRepository;
        this.todoReminderService = todoReminderService;
    }

    @Transactional(readOnly = true)
    public TodoMetadataResponse getByNeuronId(UUID neuronId) {
        TodoMetadata meta = todoMetadataRepository.findByNeuronId(neuronId)
                .orElseThrow(() -> new ResourceNotFoundException("Todo metadata not found for neuron: " + neuronId));
        return toResponse(meta);
    }

    @Transactional
    public TodoMetadataResponse getOrCreate(UUID neuronId) {
        return todoMetadataRepository.findByNeuronId(neuronId)
                .map(this::toResponse)
                .orElseGet(() -> {
                    Neuron neuron = neuronRepository.findById(neuronId)
                            .orElseThrow(() -> new ResourceNotFoundException("Neuron not found: " + neuronId));
                    TodoMetadata meta = new TodoMetadata();
                    meta.setNeuron(neuron);
                    meta.setNeuronId(neuronId);
                    meta.setPriority(TodoPriority.NORMAL);
                    return toResponse(todoMetadataRepository.save(meta));
                });
    }

    @Transactional
    public TodoMetadataResponse update(UUID neuronId, TodoMetadataRequest req) {
        Neuron neuron = neuronRepository.findById(neuronId)
                .orElseThrow(() -> new ResourceNotFoundException("Neuron not found: " + neuronId));

        TodoMetadata meta = todoMetadataRepository.findByNeuronId(neuronId)
                .orElseGet(() -> {
                    TodoMetadata m = new TodoMetadata();
                    m.setNeuron(neuron);
                    m.setNeuronId(neuronId);
                    m.setPriority(TodoPriority.NORMAL);
                    return m;
                });

        if (req.dueDate() != null) {
            meta.setDueDate(req.dueDate());
        }
        if (req.completed() != null) {
            if (req.completed() && !meta.isCompleted()) {
                meta.setCompleted(true);
                meta.setCompletedAt(TimeProvider.now());
            } else if (!req.completed() && meta.isCompleted()) {
                meta.setCompleted(false);
                meta.setCompletedAt(null);
            }
        }
        if (req.effort() != null) {
            meta.setEffort(TodoEffort.fromValue(req.effort()));
        }
        if (req.priority() != null) {
            meta.setPriority(TodoPriority.fromValue(req.priority()));
        }

        TodoMetadata saved = todoMetadataRepository.save(meta);
        todoReminderService.syncSystemReminder(neuron, saved);
        log.info("Updated todo metadata for neuron {}", neuronId);
        return toResponse(saved);
    }

    @Transactional(readOnly = true)
    public Map<UUID, TodoMetadataResponse> getByNeuronIds(List<UUID> neuronIds) {
        return todoMetadataRepository.findByNeuronIdIn(neuronIds).stream()
                .collect(Collectors.toMap(TodoMetadata::getNeuronId, this::toResponse));
    }

    @Transactional(readOnly = true)
    public List<TaskOverviewItem> listAllTasks() {
        return todoMetadataRepository.findAllActiveWithAssociations().stream()
                .map(this::toOverviewItem)
                .toList();
    }

    private TaskOverviewItem toOverviewItem(TodoMetadata meta) {
        Neuron neuron = meta.getNeuron();
        Cluster cluster = neuron.getCluster();
        Brain brain = neuron.getBrain();
        return new TaskOverviewItem(
                meta.getNeuronId(),
                neuron.getTitle(),
                meta.getDueDate(),
                meta.isCompleted(),
                meta.getCompletedAt(),
                meta.getEffort() != null ? meta.getEffort().getValue() : null,
                meta.getPriority() != null ? meta.getPriority().getValue() : "normal",
                brain.getId(),
                brain.getName(),
                brain.getColor(),
                brain.getIcon(),
                cluster.getId(),
                cluster.getName(),
                meta.getCreatedAt(),
                meta.getUpdatedAt()
        );
    }

    public TodoMetadataResponse toResponse(TodoMetadata meta) {
        return new TodoMetadataResponse(
                meta.getNeuronId(),
                meta.getDueDate(),
                meta.isCompleted(),
                meta.getCompletedAt(),
                meta.getEffort() != null ? meta.getEffort().getValue() : null,
                meta.getPriority() != null ? meta.getPriority().getValue() : "normal",
                meta.getCreatedAt(),
                meta.getUpdatedAt()
        );
    }
}
