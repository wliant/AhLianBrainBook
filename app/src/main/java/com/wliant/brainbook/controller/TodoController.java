package com.wliant.brainbook.controller;

import com.wliant.brainbook.dto.CreateTaskFromNeuronRequest;
import com.wliant.brainbook.dto.CreateTaskFromNeuronResponse;
import com.wliant.brainbook.dto.TodoMetadataRequest;
import com.wliant.brainbook.dto.TodoMetadataResponse;
import com.wliant.brainbook.model.Neuron;
import com.wliant.brainbook.repository.NeuronRepository;
import com.wliant.brainbook.service.TodoMetadataService;
import com.wliant.brainbook.service.TodoService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
public class TodoController {

    private final TodoMetadataService todoMetadataService;
    private final TodoService todoService;
    private final NeuronRepository neuronRepository;

    public TodoController(TodoMetadataService todoMetadataService,
                          TodoService todoService,
                          NeuronRepository neuronRepository) {
        this.todoMetadataService = todoMetadataService;
        this.todoService = todoService;
        this.neuronRepository = neuronRepository;
    }

    @GetMapping("/api/neurons/{neuronId}/todo")
    public ResponseEntity<TodoMetadataResponse> getOrCreateTodoMetadata(@PathVariable UUID neuronId) {
        return ResponseEntity.ok(todoMetadataService.getOrCreate(neuronId));
    }

    @PatchMapping("/api/neurons/{neuronId}/todo")
    public ResponseEntity<TodoMetadataResponse> updateTodoMetadata(
            @PathVariable UUID neuronId,
            @Valid @RequestBody TodoMetadataRequest req) {
        return ResponseEntity.ok(todoMetadataService.update(neuronId, req));
    }

    @GetMapping("/api/clusters/{clusterId}/todo")
    public ResponseEntity<Map<UUID, TodoMetadataResponse>> getClusterTodoMetadata(@PathVariable UUID clusterId) {
        List<UUID> neuronIds = neuronRepository.findByClusterIdAndIsDeletedFalseAndIsArchivedFalseOrderBySortOrderAsc(clusterId)
                .stream()
                .map(Neuron::getId)
                .toList();
        if (neuronIds.isEmpty()) {
            return ResponseEntity.ok(Map.of());
        }
        return ResponseEntity.ok(todoMetadataService.getByNeuronIds(neuronIds));
    }

    @PostMapping("/api/brains/{brainId}/tasks")
    public ResponseEntity<CreateTaskFromNeuronResponse> createTaskFromNeuron(
            @PathVariable UUID brainId,
            @Valid @RequestBody CreateTaskFromNeuronRequest req) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(todoService.createTaskFromNeuron(brainId, req));
    }
}
