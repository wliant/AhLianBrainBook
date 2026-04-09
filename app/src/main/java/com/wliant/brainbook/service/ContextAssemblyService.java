package com.wliant.brainbook.service;

import com.wliant.brainbook.dto.TagResponse;
import com.wliant.brainbook.model.Neuron;
import com.wliant.brainbook.model.NeuronLink;
import com.wliant.brainbook.repository.NeuronEmbeddingRepository;
import com.wliant.brainbook.repository.NeuronLinkRepository;
import com.wliant.brainbook.repository.NeuronRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Lazy;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.TimeUnit;

@Service
public class ContextAssemblyService {

    private static final Logger logger = LoggerFactory.getLogger(ContextAssemblyService.class);

    private static final int MAX_CONTEXT_NEURONS = 8;
    private static final int MAX_SIMILAR_NEURONS = 5;
    private static final double SIMILARITY_THRESHOLD = 0.3;
    private static final int MAX_CLUSTER_SIBLINGS = 10;
    private static final int CONTENT_PREVIEW_LENGTH = 500;
    private static final int RETRIEVAL_TIMEOUT_SECONDS = 3;

    private final NeuronEmbeddingRepository neuronEmbeddingRepository;
    private final NeuronLinkRepository neuronLinkRepository;
    private final NeuronRepository neuronRepository;
    private final TagService tagService;
    private final IntelligenceService intelligenceService;

    public ContextAssemblyService(NeuronEmbeddingRepository neuronEmbeddingRepository,
                                   NeuronLinkRepository neuronLinkRepository,
                                   NeuronRepository neuronRepository,
                                   TagService tagService,
                                   @Lazy IntelligenceService intelligenceService) {
        this.neuronEmbeddingRepository = neuronEmbeddingRepository;
        this.neuronLinkRepository = neuronLinkRepository;
        this.neuronRepository = neuronRepository;
        this.tagService = tagService;
        this.intelligenceService = intelligenceService;
    }

    public List<Map<String, Object>> assembleKnowledgeContext(
            UUID neuronId, UUID brainId, UUID clusterId, String userMessage) {

        // Run three retrieval sources in parallel
        CompletableFuture<List<ScoredNeuronRef>> similarFuture =
                CompletableFuture.supplyAsync(() -> fetchSimilarNeurons(neuronId, brainId, userMessage));

        CompletableFuture<List<ScoredNeuronRef>> linksFuture =
                CompletableFuture.supplyAsync(() -> fetchLinkedNeurons(neuronId));

        CompletableFuture<List<ScoredNeuronRef>> siblingsFuture =
                CompletableFuture.supplyAsync(() -> fetchClusterSiblings(neuronId, clusterId));

        List<ScoredNeuronRef> allRefs;
        try {
            CompletableFuture.allOf(similarFuture, linksFuture, siblingsFuture)
                    .get(RETRIEVAL_TIMEOUT_SECONDS, TimeUnit.SECONDS);

            allRefs = new ArrayList<>();
            allRefs.addAll(similarFuture.join());
            allRefs.addAll(linksFuture.join());
            allRefs.addAll(siblingsFuture.join());
        } catch (Exception e) {
            logger.warn("Context retrieval timed out or failed for neuron {}: {}", neuronId, e.getMessage());
            // Collect whatever completed
            allRefs = new ArrayList<>();
            collectIfDone(similarFuture, allRefs);
            collectIfDone(linksFuture, allRefs);
            collectIfDone(siblingsFuture, allRefs);
        }

        if (allRefs.isEmpty()) {
            return List.of();
        }

        // Deduplicate by neuron ID, keeping highest score
        Map<UUID, ScoredNeuronRef> deduped = new LinkedHashMap<>();
        for (ScoredNeuronRef ref : allRefs) {
            deduped.merge(ref.neuronId, ref, (existing, incoming) ->
                    incoming.score > existing.score ? incoming : existing);
        }

        // Sort by score descending, take top N
        List<ScoredNeuronRef> topRefs = deduped.values().stream()
                .sorted(Comparator.comparingDouble(ScoredNeuronRef::score).reversed())
                .limit(MAX_CONTEXT_NEURONS)
                .toList();

        // Batch-fetch neurons and tags
        List<UUID> neuronIds = topRefs.stream().map(ScoredNeuronRef::neuronId).toList();
        Map<UUID, Neuron> neuronsById = new HashMap<>();
        neuronRepository.findAllById(neuronIds).forEach(n -> neuronsById.put(n.getId(), n));

        Map<UUID, List<TagResponse>> tagsByNeuron = tagService.getTagsForNeurons(neuronIds);

        // Build context items
        List<Map<String, Object>> contextItems = new ArrayList<>();
        for (ScoredNeuronRef ref : topRefs) {
            Neuron neuron = neuronsById.get(ref.neuronId);
            if (neuron == null) continue;

            List<String> tagNames = tagsByNeuron.getOrDefault(ref.neuronId, List.of())
                    .stream().map(TagResponse::name).toList();

            Map<String, Object> item = new HashMap<>();
            item.put("neuron_id", neuron.getId().toString());
            item.put("title", neuron.getTitle() != null ? neuron.getTitle() : "Untitled");
            item.put("content_preview", truncate(neuron.getContentText(), CONTENT_PREVIEW_LENGTH));
            item.put("tags", tagNames);
            item.put("relationship", ref.relationship);
            item.put("score", ref.score);
            contextItems.add(item);
        }

        return contextItems;
    }

    private List<ScoredNeuronRef> fetchSimilarNeurons(UUID neuronId, UUID brainId, String userMessage) {
        try {
            // Try pre-computed embedding first
            String embeddingVector = neuronEmbeddingRepository.findEmbeddingVectorByNeuronId(neuronId);

            // Fall back to on-demand embedding of user message
            if (embeddingVector == null && userMessage != null && !userMessage.isBlank()) {
                float[] embedding = intelligenceService.computeEmbedding(userMessage);
                embeddingVector = toVectorString(embedding);
            }

            if (embeddingVector == null) {
                return List.of();
            }

            List<Object[]> results = neuronEmbeddingRepository.findMostSimilar(
                    neuronId, embeddingVector, brainId, MAX_SIMILAR_NEURONS);

            List<ScoredNeuronRef> refs = new ArrayList<>();
            for (Object[] row : results) {
                UUID id = (UUID) row[0];
                double similarity = ((Number) row[1]).doubleValue();
                if (similarity >= SIMILARITY_THRESHOLD) {
                    refs.add(new ScoredNeuronRef(id, similarity, "semantically similar"));
                }
            }
            return refs;
        } catch (Exception e) {
            logger.warn("Embedding similarity search failed for neuron {}: {}", neuronId, e.getMessage());
            return List.of();
        }
    }

    private List<ScoredNeuronRef> fetchLinkedNeurons(UUID neuronId) {
        try {
            List<NeuronLink> links = neuronLinkRepository.findAllByNeuronId(neuronId);
            List<ScoredNeuronRef> refs = new ArrayList<>();
            for (NeuronLink link : links) {
                UUID linkedId = link.getSourceNeuronId().equals(neuronId)
                        ? link.getTargetNeuronId()
                        : link.getSourceNeuronId();
                double weight = link.getWeight() != null ? link.getWeight() : 1.0;
                double score = 0.8 + weight * 0.2;
                String relationship = "linked" +
                        (link.getLinkType() != null ? " (" + link.getLinkType() + ")" : "");
                refs.add(new ScoredNeuronRef(linkedId, score, relationship));
            }
            return refs;
        } catch (Exception e) {
            logger.warn("Link retrieval failed for neuron {}: {}", neuronId, e.getMessage());
            return List.of();
        }
    }

    private List<ScoredNeuronRef> fetchClusterSiblings(UUID neuronId, UUID clusterId) {
        if (clusterId == null) {
            return List.of();
        }
        try {
            List<Neuron> clusterNeurons = neuronRepository
                    .findByClusterIdAndIsDeletedFalseAndIsArchivedFalseOrderBySortOrderAsc(clusterId);

            return clusterNeurons.stream()
                    .filter(n -> !n.getId().equals(neuronId))
                    .sorted(Comparator.comparing(
                            Neuron::getLastEditedAt,
                            Comparator.nullsLast(Comparator.reverseOrder())))
                    .limit(MAX_CLUSTER_SIBLINGS)
                    .map(n -> new ScoredNeuronRef(n.getId(), 0.3, "same cluster"))
                    .toList();
        } catch (Exception e) {
            logger.warn("Cluster sibling retrieval failed for cluster {}: {}", clusterId, e.getMessage());
            return List.of();
        }
    }

    private static void collectIfDone(CompletableFuture<List<ScoredNeuronRef>> future,
                                       List<ScoredNeuronRef> target) {
        if (future.isDone() && !future.isCompletedExceptionally()) {
            target.addAll(future.join());
        }
    }

    static String truncate(String text, int maxLength) {
        if (text == null || text.length() <= maxLength) return text != null ? text : "";
        return text.substring(0, maxLength) + "...";
    }

    public static String toVectorString(float[] embedding) {
        StringBuilder sb = new StringBuilder("[");
        for (int i = 0; i < embedding.length; i++) {
            if (i > 0) sb.append(",");
            sb.append(embedding[i]);
        }
        sb.append("]");
        return sb.toString();
    }

    record ScoredNeuronRef(UUID neuronId, double score, String relationship) {}
}
