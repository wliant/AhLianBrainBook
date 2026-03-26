package com.ahlian.brainbook.controller;

import com.ahlian.brainbook.dto.BrainRequest;
import com.ahlian.brainbook.dto.BrainResponse;
import com.ahlian.brainbook.dto.ReorderRequest;
import com.ahlian.brainbook.service.BrainService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/brains")
public class BrainController {

    private final BrainService brainService;

    public BrainController(BrainService brainService) {
        this.brainService = brainService;
    }

    @GetMapping
    public ResponseEntity<List<BrainResponse>> listBrains() {
        return ResponseEntity.ok(brainService.getAll());
    }

    @PostMapping
    public ResponseEntity<BrainResponse> createBrain(@Valid @RequestBody BrainRequest req) {
        return ResponseEntity.status(HttpStatus.CREATED).body(brainService.create(req));
    }

    @GetMapping("/{id}")
    public ResponseEntity<BrainResponse> getBrain(@PathVariable UUID id) {
        return ResponseEntity.ok(brainService.getById(id));
    }

    @PatchMapping("/{id}")
    public ResponseEntity<BrainResponse> updateBrain(@PathVariable UUID id,
                                                     @Valid @RequestBody BrainRequest req) {
        return ResponseEntity.ok(brainService.update(id, req));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteBrain(@PathVariable UUID id) {
        brainService.delete(id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{id}/archive")
    public ResponseEntity<BrainResponse> archiveBrain(@PathVariable UUID id) {
        return ResponseEntity.ok(brainService.archive(id));
    }

    @PostMapping("/{id}/restore")
    public ResponseEntity<BrainResponse> restoreBrain(@PathVariable UUID id) {
        return ResponseEntity.ok(brainService.restore(id));
    }

    @PostMapping("/reorder")
    public ResponseEntity<Void> reorderBrains(@Valid @RequestBody ReorderRequest req) {
        brainService.reorder(req);
        return ResponseEntity.ok().build();
    }
}
