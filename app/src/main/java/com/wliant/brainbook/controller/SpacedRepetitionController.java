package com.wliant.brainbook.controller;

import com.wliant.brainbook.dto.QuestionCountRequest;
import com.wliant.brainbook.dto.QuizEnabledRequest;
import com.wliant.brainbook.dto.ReviewQuestionResponse;
import com.wliant.brainbook.dto.SpacedRepetitionItemResponse;
import com.wliant.brainbook.dto.SpacedRepetitionReviewRequest;
import com.wliant.brainbook.service.ReviewQuestionService;
import com.wliant.brainbook.service.SpacedRepetitionService;
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
@RequestMapping("/api/spaced-repetition")
public class SpacedRepetitionController {

    private final SpacedRepetitionService spacedRepetitionService;
    private final ReviewQuestionService reviewQuestionService;

    public SpacedRepetitionController(SpacedRepetitionService spacedRepetitionService,
                                       ReviewQuestionService reviewQuestionService) {
        this.spacedRepetitionService = spacedRepetitionService;
        this.reviewQuestionService = reviewQuestionService;
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

    @GetMapping("/items/{itemId}/questions")
    public ResponseEntity<List<ReviewQuestionResponse>> getQuestions(@PathVariable UUID itemId) {
        return ResponseEntity.ok(reviewQuestionService.getQuestionsForItem(itemId));
    }

    @PostMapping("/items/{itemId}/questions/regenerate")
    public ResponseEntity<Void> regenerateQuestions(@PathVariable UUID itemId) {
        // Trigger async regeneration by clearing existing and letting scheduler pick up
        reviewQuestionService.markStaleByNeuron(
                spacedRepetitionService.getItemEntity(itemId).getNeuronId(), "");
        return ResponseEntity.accepted().build();
    }

    @PatchMapping("/items/{itemId}/quiz-enabled")
    public ResponseEntity<SpacedRepetitionItemResponse> updateQuizEnabled(
            @PathVariable UUID itemId,
            @Valid @RequestBody QuizEnabledRequest request) {
        spacedRepetitionService.updateQuizEnabled(itemId, request.quizEnabled());
        return ResponseEntity.ok(spacedRepetitionService.getItemById(itemId));
    }

    @PatchMapping("/items/{itemId}/question-count")
    public ResponseEntity<SpacedRepetitionItemResponse> updateQuestionCount(
            @PathVariable UUID itemId,
            @Valid @RequestBody QuestionCountRequest request) {
        spacedRepetitionService.updateQuestionCount(itemId, request.questionCount());
        return ResponseEntity.ok(spacedRepetitionService.getItemById(itemId));
    }
}
