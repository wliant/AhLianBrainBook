package com.wliant.brainbook.controller;

import com.wliant.brainbook.dto.SpacedRepetitionItemResponse;
import com.wliant.brainbook.dto.SpacedRepetitionReviewRequest;
import com.wliant.brainbook.service.SpacedRepetitionService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/spaced-repetition")
public class SpacedRepetitionController {

    private final SpacedRepetitionService spacedRepetitionService;

    public SpacedRepetitionController(SpacedRepetitionService spacedRepetitionService) {
        this.spacedRepetitionService = spacedRepetitionService;
    }

    @PostMapping("/items/{neuronId}")
    public ResponseEntity<SpacedRepetitionItemResponse> addItem(@PathVariable UUID neuronId) {
        return ResponseEntity.status(HttpStatus.CREATED).body(spacedRepetitionService.addItem(neuronId));
    }

    @DeleteMapping("/items/{neuronId}")
    public ResponseEntity<Void> removeItem(@PathVariable UUID neuronId) {
        spacedRepetitionService.removeItem(neuronId);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/items/{neuronId}")
    public ResponseEntity<SpacedRepetitionItemResponse> getItem(@PathVariable UUID neuronId) {
        return ResponseEntity.ok(spacedRepetitionService.getItem(neuronId));
    }

    @GetMapping("/items")
    public ResponseEntity<List<SpacedRepetitionItemResponse>> getAllItems() {
        return ResponseEntity.ok(spacedRepetitionService.getAllItems());
    }

    @GetMapping("/queue")
    public ResponseEntity<List<SpacedRepetitionItemResponse>> getReviewQueue() {
        return ResponseEntity.ok(spacedRepetitionService.getReviewQueue());
    }

    @PostMapping("/items/{itemId}/review")
    public ResponseEntity<SpacedRepetitionItemResponse> submitReview(
            @PathVariable UUID itemId,
            @Valid @RequestBody SpacedRepetitionReviewRequest request) {
        return ResponseEntity.ok(spacedRepetitionService.submitReview(itemId, request.quality()));
    }
}
