package com.wliant.brainbook.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
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
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class ResearchAsyncService {

    private static final Logger logger = LoggerFactory.getLogger(ResearchAsyncService.class);
    private static final int CONTENT_PREVIEW_LENGTH = 500;

    private final ClusterRepository clusterRepository;
    private final BrainRepository brainRepository;
    private final NeuronRepository neuronRepository;
    private final ResearchTopicRepository researchTopicRepository;
    private final IntelligenceService intelligenceService;
    private final ResearchSseService researchSseService;
    private final SettingsService settingsService;
    private final ObjectMapper objectMapper;

    public ResearchAsyncService(ClusterRepository clusterRepository,
                                 BrainRepository brainRepository,
                                 NeuronRepository neuronRepository,
                                 ResearchTopicRepository researchTopicRepository,
                                 IntelligenceService intelligenceService,
                                 ResearchSseService researchSseService,
                                 SettingsService settingsService,
                                 ObjectMapper objectMapper) {
        this.clusterRepository = clusterRepository;
        this.brainRepository = brainRepository;
        this.neuronRepository = neuronRepository;
        this.researchTopicRepository = researchTopicRepository;
        this.intelligenceService = intelligenceService;
        this.researchSseService = researchSseService;
        this.settingsService = settingsService;
        this.objectMapper = objectMapper;
    }

    @Async("aiTaskExecutor")
    @Transactional
    @CacheEvict(value = "clustersByBrain", allEntries = true)
    public void generateResearchGoalAsync(UUID clusterId) {
        Cluster cluster = clusterRepository.findById(clusterId).orElse(null);
        if (cluster == null) return;

        try {
            String brainName = cluster.getBrain().getName();
            List<Map<String, Object>> neuronSummaries = buildNeuronSummaries(cluster.getBrain().getId());
            String goal = intelligenceService.generateResearchGoal(brainName, neuronSummaries);

            cluster.setResearchGoal(goal);
            cluster.setStatus(ClusterStatus.READY);
            clusterRepository.save(cluster);

            researchSseService.emit(clusterId, "cluster-ready",
                    Map.of("clusterId", clusterId.toString(), "researchGoal", goal != null ? goal : ""));
        } catch (Exception e) {
            logger.error("Failed to generate research goal for cluster {}", clusterId, e);
            cluster.setStatus(ClusterStatus.READY); // Still mark as ready so it's usable
            clusterRepository.save(cluster);

            researchSseService.emit(clusterId, "cluster-ready",
                    Map.of("clusterId", clusterId.toString(), "researchGoal", ""));
        }
    }

    @Async("aiTaskExecutor")
    @Transactional
    public void generateTopicAsync(UUID topicId, String prompt, UUID clusterId) {
        ResearchTopic topic = researchTopicRepository.findById(topicId).orElse(null);
        if (topic == null) return;

        Cluster cluster = clusterRepository.findById(clusterId).orElse(null);
        if (cluster == null) return;

        try {
            String brainName = cluster.getBrain().getName();
            List<Map<String, Object>> neuronSummaries = buildNeuronSummaries(cluster.getBrain().getId());

            Map<String, Object> generated = intelligenceService.generateResearchTopic(
                    prompt != null ? prompt : "", cluster.getResearchGoal(), brainName, neuronSummaries);

            if (generated != null) {
                String title = (String) generated.getOrDefault("title", prompt != null ? prompt : "Research Topic");
                String overallCompleteness = (String) generated.getOrDefault("overall_completeness", "none");

                Map<String, Object> contentJson = new HashMap<>();
                contentJson.put("version", 1);
                contentJson.put("items", generated.getOrDefault("items", List.of()));

                topic.setTitle(title);
                topic.setContentJson(toJsonString(contentJson));
                topic.setOverallCompleteness(CompletenessLevel.fromValue(overallCompleteness));
                topic.setLastRefreshedAt(LocalDateTime.now());
            }

            topic.setStatus(ResearchTopicStatus.READY);
            researchTopicRepository.save(topic);

            researchSseService.emit(clusterId, "topic-generated",
                    Map.of("topicId", topicId.toString(), "clusterId", clusterId.toString()));
        } catch (Exception e) {
            logger.error("Failed to generate research topic {}", topicId, e);
            topic.setStatus(ResearchTopicStatus.ERROR);
            researchTopicRepository.save(topic);

            researchSseService.emit(clusterId, "topic-error",
                    Map.of("topicId", topicId.toString(), "clusterId", clusterId.toString(),
                            "error", e.getMessage() != null ? e.getMessage() : "Generation failed"));
        }
    }

    @Async("aiTaskExecutor")
    @Transactional
    public void updateTopicAsync(UUID topicId, UUID clusterId) {
        ResearchTopic topic = researchTopicRepository.findById(topicId).orElse(null);
        if (topic == null) return;

        Cluster cluster = clusterRepository.findById(clusterId).orElse(null);
        if (cluster == null) return;

        try {
            String brainName = cluster.getBrain().getName();
            List<Map<String, Object>> neuronSummaries = buildNeuronSummaries(cluster.getBrain().getId());
            Map<String, Object> contentJson = parseContentJson(topic.getContentJson());

            @SuppressWarnings("unchecked")
            List<Map<String, Object>> items = (List<Map<String, Object>>) contentJson.getOrDefault("items", List.of());

            Map<String, Object> scored = intelligenceService.scoreResearchTopic(
                    items, cluster.getResearchGoal(), brainName, neuronSummaries);

            if (scored != null) {
                contentJson.put("items", scored.getOrDefault("items", items));
                String overallCompleteness = (String) scored.getOrDefault("overall_completeness", "none");
                topic.setContentJson(toJsonString(contentJson));
                topic.setOverallCompleteness(CompletenessLevel.fromValue(overallCompleteness));
                topic.setLastRefreshedAt(LocalDateTime.now());
            }

            topic.setStatus(ResearchTopicStatus.READY);
            topic.setLastUpdatedBy(settingsService.getDisplayName());
            researchTopicRepository.save(topic);

            researchSseService.emit(clusterId, "topic-updated",
                    Map.of("topicId", topicId.toString(), "clusterId", clusterId.toString()));
        } catch (Exception e) {
            logger.error("Failed to update research topic {}", topicId, e);
            topic.setStatus(ResearchTopicStatus.ERROR);
            researchTopicRepository.save(topic);

            researchSseService.emit(clusterId, "topic-error",
                    Map.of("topicId", topicId.toString(), "clusterId", clusterId.toString(),
                            "error", e.getMessage() != null ? e.getMessage() : "Update failed"));
        }
    }

    List<Map<String, Object>> buildNeuronSummaries(UUID brainId) {
        List<Neuron> neurons = neuronRepository.findByBrainIdAndIsDeletedFalse(brainId);
        return neurons.stream()
                .map(n -> {
                    Map<String, Object> summary = new HashMap<>();
                    summary.put("neuron_id", n.getId().toString());
                    summary.put("title", n.getTitle() != null ? n.getTitle() : "Untitled");
                    String contentText = n.getContentText() != null ? n.getContentText() : "";
                    if (contentText.length() > CONTENT_PREVIEW_LENGTH) {
                        contentText = contentText.substring(0, CONTENT_PREVIEW_LENGTH);
                    }
                    summary.put("content_preview", contentText);
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
