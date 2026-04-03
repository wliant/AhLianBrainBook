package com.wliant.brainbook.service;

import com.wliant.brainbook.model.Neuron;
import com.wliant.brainbook.repository.NeuronEmbeddingRepository;
import com.wliant.brainbook.repository.NeuronRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

import java.util.UUID;

@Service
public class LinkSuggestionAsyncService {

    private static final Logger logger = LoggerFactory.getLogger(LinkSuggestionAsyncService.class);

    private final NeuronRepository neuronRepository;
    private final NeuronEmbeddingRepository neuronEmbeddingRepository;
    private final IntelligenceService intelligenceService;
    private final LinkSuggestionService linkSuggestionService;
    private final TransactionTemplate transactionTemplate;

    public LinkSuggestionAsyncService(NeuronRepository neuronRepository,
                                       NeuronEmbeddingRepository neuronEmbeddingRepository,
                                       IntelligenceService intelligenceService,
                                       LinkSuggestionService linkSuggestionService,
                                       TransactionTemplate transactionTemplate) {
        this.neuronRepository = neuronRepository;
        this.neuronEmbeddingRepository = neuronEmbeddingRepository;
        this.intelligenceService = intelligenceService;
        this.linkSuggestionService = linkSuggestionService;
        this.transactionTemplate = transactionTemplate;
    }

    @Async("aiTaskExecutor")
    public void recomputeAllSuggestions(UUID neuronId, String contentJson) {
        // Phase 1: Recompute reference suggestions in a transaction
        try {
            transactionTemplate.executeWithoutResult(status ->
                    linkSuggestionService.recomputeReferenceSuggestions(neuronId, contentJson));
        } catch (Exception e) {
            logger.error("Failed to recompute reference suggestions for neuron {}", neuronId, e);
        }

        // Phase 2: Compute embedding — NO transaction (calls external service)
        String contentText = transactionTemplate.execute(status -> {
            Neuron neuron = neuronRepository.findById(neuronId).orElse(null);
            if (neuron == null) return null;
            return neuron.getContentText();
        });

        if (contentText == null || contentText.isBlank()) {
            logger.debug("Neuron {} has no content text, skipping embedding", neuronId);
            return;
        }

        float[] embedding;
        try {
            embedding = intelligenceService.computeEmbedding(contentText);
        } catch (Exception e) {
            logger.warn("Failed to compute embedding for neuron {}: {}", neuronId, e.getMessage());
            return;
        }

        // Phase 3: Store embedding and recompute related suggestions in a transaction
        String embeddingVector = toVectorString(embedding);
        try {
            transactionTemplate.executeWithoutResult(status -> {
                neuronEmbeddingRepository.upsertEmbedding(neuronId, embeddingVector, "nomic-embed-text");
                linkSuggestionService.recomputeRelatedSuggestions(neuronId, embeddingVector);
            });
        } catch (Exception e) {
            logger.error("Failed to store embedding/related suggestions for neuron {}", neuronId, e);
        }
    }

    private String toVectorString(float[] embedding) {
        StringBuilder sb = new StringBuilder("[");
        for (int i = 0; i < embedding.length; i++) {
            if (i > 0) sb.append(",");
            sb.append(embedding[i]);
        }
        sb.append("]");
        return sb.toString();
    }
}
