package com.wliant.brainbook.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.wliant.brainbook.dto.TagResponse;
import com.wliant.brainbook.model.Cluster;
import com.wliant.brainbook.model.ClusterStatus;
import com.wliant.brainbook.model.CompletenessLevel;
import com.wliant.brainbook.model.Neuron;
import com.wliant.brainbook.model.ResearchTopic;
import com.wliant.brainbook.model.ResearchTopicStatus;
import com.wliant.brainbook.repository.BrainRepository;
import com.wliant.brainbook.repository.ClusterRepository;
import com.wliant.brainbook.repository.NeuronRepository;
import com.wliant.brainbook.repository.ResearchTopicRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.Clock;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class ResearchAsyncService {

    private static final Logger logger = LoggerFactory.getLogger(ResearchAsyncService.class);
    private static final int DEFAULT_CONTENT_PREVIEW_LENGTH = 1500;
    private static final int SCORER_CONTENT_PREVIEW_LENGTH = 2000;

    private final ClusterRepository clusterRepository;
    private final BrainRepository brainRepository;
    private final NeuronRepository neuronRepository;
    private final ResearchTopicRepository researchTopicRepository;
    private final IntelligenceService intelligenceService;
    private final ResearchSseService researchSseService;
    private final SettingsService settingsService;
    private final TagService tagService;
    private final ObjectMapper objectMapper;
    private final TransactionTemplate transactionTemplate;
    private final Clock clock;

    public ResearchAsyncService(ClusterRepository clusterRepository,
                                 BrainRepository brainRepository,
                                 NeuronRepository neuronRepository,
                                 ResearchTopicRepository researchTopicRepository,
                                 IntelligenceService intelligenceService,
                                 ResearchSseService researchSseService,
                                 SettingsService settingsService,
                                 TagService tagService,
                                 ObjectMapper objectMapper,
                                 TransactionTemplate transactionTemplate,
                                 Clock clock) {
        this.clusterRepository = clusterRepository;
        this.brainRepository = brainRepository;
        this.neuronRepository = neuronRepository;
        this.researchTopicRepository = researchTopicRepository;
        this.intelligenceService = intelligenceService;
        this.researchSseService = researchSseService;
        this.settingsService = settingsService;
        this.tagService = tagService;
        this.objectMapper = objectMapper;
        this.transactionTemplate = transactionTemplate;
        this.clock = clock;
    }

    private record ClusterContext(UUID clusterId, String brainName, List<Map<String, Object>> neuronSummaries,
                                   String researchGoal) {}

    private record GoalContext(UUID clusterId, String brainName, String brainDescription) {}

    private record TopicContext(UUID topicId, UUID clusterId, String brainName, String researchGoal,
                                 List<Map<String, Object>> neuronSummaries, String existingContentJson,
                                 List<String> existingTopicTitles) {}

    @Async("aiTaskExecutor")
    @CacheEvict(value = "clustersByBrain", allEntries = true)
    public void generateResearchGoalAsync(UUID clusterId) {
        // Phase 1: Read in transaction
        GoalContext ctx = transactionTemplate.execute(status -> {
            Cluster cluster = clusterRepository.findById(clusterId).orElse(null);
            if (cluster == null) return null;
            String brainName = cluster.getBrain().getName();
            String brainDescription = cluster.getBrain().getDescription() != null
                    ? cluster.getBrain().getDescription() : "";
            return new GoalContext(clusterId, brainName, brainDescription);
        });

        if (ctx == null) return;

        // Phase 2: Call intelligence — NO transaction
        String goal;
        try {
            goal = intelligenceService.generateResearchGoal(ctx.brainName(), ctx.brainDescription());
        } catch (Exception e) {
            logger.error("Failed to generate research goal for cluster {}", clusterId, e);
            goal = null;
        }

        // Phase 3: Save in transaction
        final String finalGoal = goal;
        transactionTemplate.executeWithoutResult(status -> {
            Cluster cluster = clusterRepository.findById(clusterId).orElse(null);
            if (cluster == null) return;
            cluster.setResearchGoal(finalGoal != null ? finalGoal : "");
            cluster.setStatus(ClusterStatus.READY);
            clusterRepository.save(cluster);
        });

        researchSseService.emit(clusterId, "cluster-ready",
                Map.of("clusterId", clusterId.toString(), "researchGoal", goal != null ? goal : ""));
    }

    @Async("aiTaskExecutor")
    public void generateTopicAsync(UUID topicId, String prompt, UUID clusterId) {
        // Phase 1: Read in transaction
        TopicContext ctx = transactionTemplate.execute(status -> {
            ResearchTopic topic = researchTopicRepository.findById(topicId).orElse(null);
            if (topic == null) return null;
            Cluster cluster = clusterRepository.findById(clusterId).orElse(null);
            if (cluster == null) return null;
            String brainName = cluster.getBrain().getName();
            List<Map<String, Object>> neuronSummaries = buildNeuronSummaries(cluster.getBrain().getId());
            List<String> existingTopicTitles = researchTopicRepository
                    .findByClusterIdOrderBySortOrder(clusterId).stream()
                    .map(ResearchTopic::getTitle)
                    .collect(Collectors.toList());
            return new TopicContext(topicId, clusterId, brainName, cluster.getResearchGoal(),
                    neuronSummaries, null, existingTopicTitles);
        });

        if (ctx == null) return;

        // Phase 2: Call intelligence — NO transaction
        Map<String, Object> generated;
        try {
            generated = intelligenceService.generateResearchTopic(
                    prompt != null ? prompt : "", ctx.researchGoal(), ctx.brainName(),
                    ctx.neuronSummaries(), ctx.existingTopicTitles());
        } catch (Exception e) {
            logger.error("Failed to generate research topic {}", topicId, e);
            transactionTemplate.executeWithoutResult(status -> {
                ResearchTopic topic = researchTopicRepository.findById(topicId).orElse(null);
                if (topic != null) {
                    topic.setStatus(ResearchTopicStatus.ERROR);
                    researchTopicRepository.save(topic);
                }
            });
            researchSseService.emit(clusterId, "topic-error",
                    Map.of("topicId", topicId.toString(), "clusterId", clusterId.toString(),
                            "error", e.getMessage() != null ? e.getMessage() : "Generation failed"));
            return;
        }

        // Phase 3: Save in transaction
        transactionTemplate.executeWithoutResult(status -> {
            ResearchTopic topic = researchTopicRepository.findById(topicId).orElse(null);
            if (topic == null) return;

            if (generated != null) {
                String title = (String) generated.getOrDefault("title", prompt != null ? prompt : "Research Topic");
                String overallCompleteness = (String) generated.getOrDefault("overall_completeness", "none");

                Map<String, Object> contentJson = new HashMap<>();
                contentJson.put("version", 1);
                contentJson.put("items", generated.getOrDefault("items", List.of()));

                topic.setTitle(title);
                topic.setContentJson(toJsonString(contentJson));
                topic.setOverallCompleteness(CompletenessLevel.fromValue(overallCompleteness));
                topic.setLastRefreshedAt(LocalDateTime.now(clock));
            }

            topic.setStatus(ResearchTopicStatus.READY);
            researchTopicRepository.save(topic);
        });

        researchSseService.emit(clusterId, "topic-generated",
                Map.of("topicId", topicId.toString(), "clusterId", clusterId.toString()));
    }

    @Async("aiTaskExecutor")
    public void updateTopicAsync(UUID topicId, UUID clusterId) {
        // Phase 1: Read in transaction
        TopicContext ctx = transactionTemplate.execute(status -> {
            ResearchTopic topic = researchTopicRepository.findById(topicId).orElse(null);
            if (topic == null) return null;
            Cluster cluster = clusterRepository.findById(clusterId).orElse(null);
            if (cluster == null) return null;
            String brainName = cluster.getBrain().getName();
            List<Map<String, Object>> neuronSummaries = buildNeuronSummaries(
                    cluster.getBrain().getId(), SCORER_CONTENT_PREVIEW_LENGTH);
            return new TopicContext(topicId, clusterId, brainName, cluster.getResearchGoal(),
                    neuronSummaries, topic.getContentJson(), List.of());
        });

        if (ctx == null) return;

        // Parse existing content outside transaction
        Map<String, Object> contentJson = parseContentJson(ctx.existingContentJson());
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> items = (List<Map<String, Object>>) contentJson.getOrDefault("items", List.of());

        // Phase 2: Call intelligence — NO transaction
        Map<String, Object> scored;
        try {
            scored = intelligenceService.scoreResearchTopic(
                    items, ctx.researchGoal(), ctx.brainName(), ctx.neuronSummaries());
        } catch (Exception e) {
            logger.error("Failed to update research topic {}", topicId, e);
            transactionTemplate.executeWithoutResult(status -> {
                ResearchTopic topic = researchTopicRepository.findById(topicId).orElse(null);
                if (topic != null) {
                    topic.setStatus(ResearchTopicStatus.ERROR);
                    researchTopicRepository.save(topic);
                }
            });
            researchSseService.emit(clusterId, "topic-error",
                    Map.of("topicId", topicId.toString(), "clusterId", clusterId.toString(),
                            "error", e.getMessage() != null ? e.getMessage() : "Update failed"));
            return;
        }

        // Phase 3: Save in transaction
        transactionTemplate.executeWithoutResult(status -> {
            ResearchTopic topic = researchTopicRepository.findById(topicId).orElse(null);
            if (topic == null) return;

            Map<String, Object> freshContentJson = parseContentJson(topic.getContentJson());
            if (scored != null) {
                freshContentJson.put("items", scored.getOrDefault("items", items));
                String overallCompleteness = (String) scored.getOrDefault("overall_completeness", "none");
                topic.setContentJson(toJsonString(freshContentJson));
                topic.setOverallCompleteness(CompletenessLevel.fromValue(overallCompleteness));
                topic.setLastRefreshedAt(LocalDateTime.now(clock));
            }

            topic.setStatus(ResearchTopicStatus.READY);
            topic.setLastUpdatedBy(settingsService.getDisplayName());
            researchTopicRepository.save(topic);
        });

        researchSseService.emit(clusterId, "topic-updated",
                Map.of("topicId", topicId.toString(), "clusterId", clusterId.toString()));
    }

    List<Map<String, Object>> buildNeuronSummaries(UUID brainId) {
        return buildNeuronSummaries(brainId, DEFAULT_CONTENT_PREVIEW_LENGTH);
    }

    List<Map<String, Object>> buildNeuronSummaries(UUID brainId, int previewLength) {
        List<Neuron> neurons = neuronRepository.findByBrainIdAndIsDeletedFalse(brainId);
        List<UUID> neuronIds = neurons.stream().map(Neuron::getId).collect(Collectors.toList());
        Map<UUID, List<TagResponse>> tagsByNeuron = tagService.getTagsForNeurons(neuronIds);
        return neurons.stream()
                .map(n -> {
                    Map<String, Object> summary = new HashMap<>();
                    summary.put("neuron_id", n.getId().toString());
                    summary.put("title", n.getTitle() != null ? n.getTitle() : "Untitled");
                    String contentText = n.getContentText() != null ? n.getContentText() : "";
                    if (contentText.length() > previewLength) {
                        contentText = contentText.substring(0, previewLength);
                    }
                    summary.put("content_preview", contentText);
                    List<String> tags = tagsByNeuron.getOrDefault(n.getId(), List.of()).stream()
                            .map(TagResponse::name).toList();
                    summary.put("tags", tags);
                    return summary;
                })
                .collect(Collectors.toList());
    }

    private Map<String, Object> parseContentJson(String json) {
        if (json == null || json.isBlank()) {
            return new HashMap<>(Map.of("version", 1, "items", List.of()));
        }
        try {
            return objectMapper.readValue(json, new TypeReference<>() {});
        } catch (JsonProcessingException e) {
            return new HashMap<>(Map.of("version", 1, "items", List.of()));
        }
    }

    private String toJsonString(Map<String, Object> map) {
        try {
            return objectMapper.writeValueAsString(map);
        } catch (JsonProcessingException e) {
            throw new RuntimeException("Failed to serialize content JSON", e);
        }
    }
}
