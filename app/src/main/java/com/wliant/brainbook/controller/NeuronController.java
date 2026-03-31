package com.wliant.brainbook.controller;

import com.wliant.brainbook.dto.MoveNeuronRequest;
import com.wliant.brainbook.dto.NeuronContentRequest;
import com.wliant.brainbook.dto.NeuronRequest;
import com.wliant.brainbook.dto.NeuronResponse;
import com.wliant.brainbook.dto.NeuronSummary;
import com.wliant.brainbook.dto.ReminderRequest;
import com.wliant.brainbook.dto.ReminderResponse;
import com.wliant.brainbook.dto.ReorderRequest;
import com.wliant.brainbook.service.NeuronService;
import com.wliant.brainbook.service.ReminderService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.context.request.WebRequest;

import java.util.List;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@RestController
@RequestMapping("/api/neurons")
public class NeuronController {

    private final NeuronService neuronService;
    private final ReminderService reminderService;

    public NeuronController(NeuronService neuronService, ReminderService reminderService) {
        this.neuronService = neuronService;
        this.reminderService = reminderService;
    }

    @GetMapping("/cluster/{clusterId}")
    public ResponseEntity<List<NeuronResponse>> listNeurons(@PathVariable UUID clusterId) {
        return ResponseEntity.ok(neuronService.getByClusterId(clusterId));
    }

    @GetMapping("/recent")
    public ResponseEntity<List<NeuronResponse>> getRecent(
            @RequestParam(defaultValue = "20") int limit) {
        return ResponseEntity.ok(neuronService.getRecent(limit));
    }

    @GetMapping("/favorites")
    public ResponseEntity<List<NeuronResponse>> getFavorites() {
        return ResponseEntity.ok(neuronService.getFavorites());
    }

    @GetMapping("/pinned")
    public ResponseEntity<List<NeuronResponse>> getPinned() {
        return ResponseEntity.ok(neuronService.getPinned());
    }

    @GetMapping("/trash")
    public ResponseEntity<List<NeuronResponse>> getTrash() {
        return ResponseEntity.ok(neuronService.getTrash());
    }

    @GetMapping("/search")
    public ResponseEntity<List<NeuronSummary>> searchByTitle(
            @RequestParam String title,
            @RequestParam(required = false) UUID brainId,
            @RequestParam(defaultValue = "10") int limit) {
        return ResponseEntity.ok(neuronService.searchByTitle(title, brainId, limit));
    }

    @PostMapping
    public ResponseEntity<NeuronResponse> createNeuron(@Valid @RequestBody NeuronRequest req) {
        return ResponseEntity.status(HttpStatus.CREATED).body(neuronService.create(req));
    }

    @GetMapping("/{id}")
    public ResponseEntity<NeuronResponse> getNeuron(@PathVariable UUID id, WebRequest request) {
        NeuronResponse neuron = neuronService.getById(id);
        String etag = "\"" + neuron.version() + "\"";
        if (request.checkNotModified(etag)) {
            return null;
        }
        return ResponseEntity.ok().eTag(etag).body(neuron);
    }

    @PatchMapping("/{id}")
    public ResponseEntity<NeuronResponse> updateNeuron(@PathVariable UUID id,
                                                       @Valid @RequestBody NeuronRequest req) {
        return ResponseEntity.ok(neuronService.update(id, req));
    }

    @PutMapping("/{id}/content")
    public ResponseEntity<NeuronResponse> updateContent(@PathVariable UUID id,
                                                        @RequestBody NeuronContentRequest req) {
        return ResponseEntity.ok(neuronService.updateContent(id, req));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteNeuron(@PathVariable UUID id) {
        neuronService.delete(id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{id}/archive")
    public ResponseEntity<NeuronResponse> archiveNeuron(@PathVariable UUID id) {
        return ResponseEntity.ok(neuronService.archive(id));
    }

    @PostMapping("/{id}/restore")
    public ResponseEntity<NeuronResponse> restoreNeuron(@PathVariable UUID id) {
        return ResponseEntity.ok(neuronService.restore(id));
    }

    @PostMapping("/{id}/move")
    public ResponseEntity<NeuronResponse> moveNeuron(@PathVariable UUID id,
                                                     @Valid @RequestBody MoveNeuronRequest req) {
        return ResponseEntity.ok(neuronService.move(id, req));
    }

    @PostMapping("/{id}/duplicate")
    public ResponseEntity<NeuronResponse> duplicateNeuron(@PathVariable UUID id) {
        return ResponseEntity.status(HttpStatus.CREATED).body(neuronService.duplicate(id));
    }

    @PostMapping("/{id}/favorite")
    public ResponseEntity<NeuronResponse> toggleFavorite(@PathVariable UUID id) {
        return ResponseEntity.ok(neuronService.toggleFavorite(id));
    }

    @PostMapping("/{id}/pin")
    public ResponseEntity<NeuronResponse> togglePin(@PathVariable UUID id) {
        return ResponseEntity.ok(neuronService.togglePin(id));
    }

    @PostMapping("/reorder")
    public ResponseEntity<Void> reorderNeurons(@Valid @RequestBody ReorderRequest req) {
        neuronService.reorder(req);
        return ResponseEntity.ok().build();
    }

    @PostMapping("/{id}/restore-from-trash")
    public ResponseEntity<NeuronResponse> restoreFromTrash(@PathVariable UUID id) {
        return ResponseEntity.ok(neuronService.restoreFromTrash(id));
    }

    @DeleteMapping("/{id}/permanent")
    public ResponseEntity<Void> permanentDelete(@PathVariable UUID id) {
        neuronService.permanentDelete(id);
        return ResponseEntity.noContent().build();
    }

    // Reminder endpoints

    @PostMapping("/{id}/reminders")
    public ResponseEntity<ReminderResponse> createReminder(@PathVariable UUID id,
                                                            @Valid @RequestBody ReminderRequest req) {
        return ResponseEntity.status(HttpStatus.CREATED).body(reminderService.create(id, req));
    }

    @GetMapping("/{id}/reminders")
    public ResponseEntity<List<ReminderResponse>> listReminders(@PathVariable UUID id) {
        return ResponseEntity.ok(reminderService.listByNeuronId(id));
    }

    @PutMapping("/{id}/reminders/{reminderId}")
    public ResponseEntity<ReminderResponse> updateReminder(@PathVariable UUID id,
                                                            @PathVariable UUID reminderId,
                                                            @Valid @RequestBody ReminderRequest req) {
        return ResponseEntity.ok(reminderService.update(reminderId, req));
    }

    @DeleteMapping("/{id}/reminders/{reminderId}")
    public ResponseEntity<Void> deleteReminder(@PathVariable UUID id,
                                                @PathVariable UUID reminderId) {
        reminderService.delete(reminderId);
        return ResponseEntity.noContent().build();
    }
}
