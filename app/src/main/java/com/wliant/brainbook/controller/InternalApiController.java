package com.wliant.brainbook.controller;

import com.wliant.brainbook.exception.ResourceNotFoundException;
import com.wliant.brainbook.model.Neuron;
import com.wliant.brainbook.repository.NeuronEmbeddingRepository;
import com.wliant.brainbook.repository.NeuronRepository;
import com.wliant.brainbook.service.ContextAssemblyService;
import com.wliant.brainbook.service.IntelligenceService;
import com.wliant.brainbook.service.SearchService;
import com.wliant.brainbook.dto.SearchResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/internal")
public class InternalApiController {

    private final SearchService searchService;
    private final IntelligenceService intelligenceService;
    private final NeuronEmbeddingRepository neuronEmbeddingRepository;
    private final NeuronRepository neuronRepository;

    @Value("${app.internal-api-key:}")
    private String internalApiKey;

    public InternalApiController(SearchService searchService,
                                  IntelligenceService intelligenceService,
                                  NeuronEmbeddingRepository neuronEmbeddingRepository,
                                  NeuronRepository neuronRepository) {
        this.searchService = searchService;
        this.intelligenceService = intelligenceService;
        this.neuronEmbeddingRepository = neuronEmbeddingRepository;
        this.neuronRepository = neuronRepository;
    }

    @GetMapping("/search")
    public ResponseEntity<?> search(
            @RequestParam(name = "q") String query,
            @RequestParam UUID brainId,
            @RequestParam(defaultValue = "5") int size,
            @RequestHeader(name = "X-Internal-Key", required = false) String apiKey) {
        if (!isAuthorized(apiKey)) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("Unauthorized");
        }
        int clampedSize = Math.max(1, Math.min(20, size));
        SearchResponse result = searchService.search(query, brainId, null, null, null, 0, clampedSize);
        List<Map<String, Object>> items = result.results().stream()
                .map(r -> {
                    Map<String, Object> m = new HashMap<>();
                    m.put("neuronId", r.neuron().id().toString());
                    m.put("title", r.neuron().title());
                    m.put("preview", r.highlight());
                    m.put("score", r.rank());
                    return m;
                })
                .toList();
        return ResponseEntity.ok(items);
    }

    @PostMapping("/similar")
    public ResponseEntity<?> similar(
            @RequestBody SimilarRequest request,
            @RequestHeader(name = "X-Internal-Key", required = false) String apiKey) {
        if (!isAuthorized(apiKey)) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("Unauthorized");
        }
        int limit = Math.max(1, Math.min(20, request.limit()));

        float[] embedding = intelligenceService.computeEmbedding(request.text());
        String embeddingVector = ContextAssemblyService.toVectorString(embedding);

        // Use a zero UUID to avoid excluding any neuron
        UUID dummyId = UUID.fromString("00000000-0000-0000-0000-000000000000");
        List<Object[]> results = neuronEmbeddingRepository.findMostSimilar(
                dummyId, embeddingVector, request.brainId(), limit);

        List<UUID> neuronIds = results.stream()
                .map(r -> (UUID) r[0])
                .toList();
        Map<UUID, Neuron> neuronsById = new HashMap<>();
        neuronRepository.findAllById(neuronIds).forEach(n -> neuronsById.put(n.getId(), n));

        List<Map<String, Object>> items = new ArrayList<>();
        for (Object[] row : results) {
            UUID neuronId = (UUID) row[0];
            double similarity = ((Number) row[1]).doubleValue();
            Neuron neuron = neuronsById.get(neuronId);
            if (neuron == null) continue;
            Map<String, Object> m = new HashMap<>();
            m.put("neuronId", neuronId.toString());
            m.put("title", neuron.getTitle() != null ? neuron.getTitle() : "Untitled");
            m.put("preview", truncate(neuron.getContentText(), 500));
            m.put("similarity", similarity);
            items.add(m);
        }
        return ResponseEntity.ok(items);
    }

    @GetMapping("/neurons/{id}/content")
    public ResponseEntity<?> neuronContent(
            @PathVariable UUID id,
            @RequestHeader(name = "X-Internal-Key", required = false) String apiKey) {
        if (!isAuthorized(apiKey)) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("Unauthorized");
        }
        Neuron neuron = neuronRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Neuron not found: " + id));
        Map<String, Object> result = new HashMap<>();
        result.put("neuronId", neuron.getId().toString());
        result.put("title", neuron.getTitle() != null ? neuron.getTitle() : "Untitled");
        result.put("contentText", truncate(neuron.getContentText(), 2000));
        return ResponseEntity.ok(result);
    }

    private boolean isAuthorized(String apiKey) {
        if (internalApiKey == null || internalApiKey.isBlank()) {
            return true; // Dev mode — no key required
        }
        return internalApiKey.equals(apiKey);
    }

    private static String truncate(String text, int maxLength) {
        if (text == null) return "";
        if (text.length() <= maxLength) return text;
        return text.substring(0, maxLength) + "...";
    }

    public record SimilarRequest(String text, UUID brainId, int limit) {
        public SimilarRequest {
            if (limit <= 0) limit = 5;
        }
    }
}
