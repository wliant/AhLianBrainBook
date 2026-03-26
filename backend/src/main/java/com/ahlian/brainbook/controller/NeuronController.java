package com.ahlian.brainbook.controller;

import com.ahlian.brainbook.dto.MoveNeuronRequest;
import com.ahlian.brainbook.dto.NeuronContentRequest;
import com.ahlian.brainbook.dto.NeuronRequest;
import com.ahlian.brainbook.dto.NeuronResponse;
import com.ahlian.brainbook.dto.ReorderRequest;
import com.ahlian.brainbook.service.NeuronService;
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

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/neurons")
public class NeuronController {

    private final NeuronService neuronService;

    public NeuronController(NeuronService neuronService) {
        this.neuronService = neuronService;
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

    @PostMapping
    public ResponseEntity<NeuronResponse> createNeuron(@Valid @RequestBody NeuronRequest req) {
        return ResponseEntity.status(HttpStatus.CREATED).body(neuronService.create(req));
    }

    @GetMapping("/{id}")
    public ResponseEntity<NeuronResponse> getNeuron(@PathVariable UUID id) {
        return ResponseEntity.ok(neuronService.getById(id));
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
}
