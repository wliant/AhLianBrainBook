package com.wliant.brainbook.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.wliant.brainbook.dto.CreateResearchTopicRequest;
import com.wliant.brainbook.dto.ReorderRequest;
import com.wliant.brainbook.dto.ResearchTopicResponse;
import com.wliant.brainbook.exception.ConflictException;
import com.wliant.brainbook.exception.ResourceNotFoundException;
import com.wliant.brainbook.model.Brain;
import com.wliant.brainbook.model.Cluster;
import com.wliant.brainbook.model.ClusterType;
import com.wliant.brainbook.model.CompletenessLevel;
import com.wliant.brainbook.model.Neuron;
import com.wliant.brainbook.model.ResearchTopic;
import com.wliant.brainbook.repository.BrainRepository;
import com.wliant.brainbook.repository.ClusterRepository;
import com.wliant.brainbook.repository.NeuronRepository;
import com.wliant.brainbook.repository.ResearchTopicRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestClientException;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@Transactional
public class ResearchTopicService {

    private static final Logger logger = LoggerFactory.getLogger(ResearchTopicService.class);
    private static final int CONTENT_PREVIEW_LENGTH = 500;

    private final ResearchTopicRepository researchTopicRepository;
    private final ClusterRepository clusterRepository;
    private final BrainRepository brainRepository;
    private final NeuronRepository neuronRepository;
    private final IntelligenceService intelligenceService;
    private final SettingsService settingsService;
    private final ObjectMapper objectMapper;

    public ResearchTopicService(ResearchTopicRepository researchTopicRepository,
                                 ClusterRepository clusterRepository,
                                 BrainRepository brainRepository,
                                 NeuronRepository neuronRepository,
                                 IntelligenceService intelligenceService,
                                 SettingsService settingsService,
                                 ObjectMapper objectMapper) {
        this.researchTopicRepository = researchTopicRepository;
        this.clusterRepository = clusterRepository;
        this.brainRepository = brainRepository;
        this.neuronRepository = neuronRepository;
        this.intelligenceService = intelligenceService;
        this.settingsService = settingsService;
        this.objectMapper = objectMapper;
    }

    public List<ResearchTopicResponse> list(UUID clusterId) {
        return researchTopicRepository.findByClusterIdOrderBySortOrder(clusterId).stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    public ResearchTopicResponse getById(UUID id) {
        ResearchTopic topic = researchTopicRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Research topic not found: " + id));
        return toResponse(topic);
    }

    public ResearchTopicResponse create(UUID clusterId, CreateResearchTopicRequest req) {
        Cluster cluster = clusterRepository.findById(clusterId)
                .orElseThrow(() -> new ResourceNotFoundException("Cluster not found: " + clusterId));

        if (cluster.getType() != ClusterType.AI_RESEARCH) {
            throw new ConflictException("Research topics can only be created in AI Research clusters");
        }

        Brain brain = brainRepository.findById(cluster.getBrain().getId())
                .orElseThrow(() -> new ResourceNotFoundException("Brain not found"));

        List<Map<String, Object>> neuronSummaries = buildNeuronSummaries(brain.getId());

        // Call intelligence service to generate the topic
        Map<String, Object> generated;
        try {
            generated = intelligenceService.generateResearchTopic(
                    req.prompt(), cluster.getResearchGoal(), brain.getName(), neuronSummaries);
        } catch (RestClientException e) {
            logger.error("Failed to generate research topic", e);
            throw new ConflictException("Failed to generate research topic: AI service unavailable");
        }

        if (generated == null) {
            throw new ConflictException("No response from AI service");
        }

        String user = settingsService.getDisplayName();
        String title = (String) generated.getOrDefault("title", req.prompt());
        String overallCompleteness = (String) generated.getOrDefault("overall_completeness", "none");

        // Build content JSON
        Map<String, Object> contentJson = new HashMap<>();
        contentJson.put("version", 1);
        contentJson.put("items", generated.getOrDefault("items", List.of()));

        ResearchTopic topic = new ResearchTopic();
        topic.setCluster(cluster);
        topic.setBrain(brain);
        topic.setTitle(title);
        topic.setPrompt(req.prompt());
        topic.setContentJson(toJsonString(contentJson));
        topic.setOverallCompleteness(CompletenessLevel.fromValue(overallCompleteness));
        topic.setLastRefreshedAt(LocalDateTime.now());
        topic.setSortOrder(0);
        topic.setCreatedBy(user);
        topic.setLastUpdatedBy(user);

        ResearchTopic saved = researchTopicRepository.save(topic);
        return toResponse(saved);
    }

    public void delete(UUID id) {
        ResearchTopic topic = researchTopicRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Research topic not found: " + id));
        researchTopicRepository.delete(topic);
    }

    public void reorder(ReorderRequest req) {
        ReorderHelper.reorder(req, researchTopicRepository, ResearchTopic::setSortOrder, "ResearchTopic");
    }

    public ResearchTopicResponse refresh(UUID topicId) {
        ResearchTopic topic = researchTopicRepository.findById(topicId)
                .orElseThrow(() -> new ResourceNotFoundException("Research topic not found: " + topicId));

        Cluster cluster = clusterRepository.findById(topic.getClusterId())
                .orElseThrow(() -> new ResourceNotFoundException("Cluster not found"));
        Brain brain = brainRepository.findById(topic.getBrainId())
                .orElseThrow(() -> new ResourceNotFoundException("Brain not found"));

        List<Map<String, Object>> neuronSummaries = buildNeuronSummaries(brain.getId());
        Map<String, Object> contentJson = parseContentJson(topic.getContentJson());

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> items = (List<Map<String, Object>>) contentJson.getOrDefault("items", List.of());

        Map<String, Object> scored;
        try {
            scored = intelligenceService.scoreResearchTopic(
                    items, cluster.getResearchGoal(), brain.getName(), neuronSummaries);
        } catch (RestClientException e) {
            logger.error("Failed to score research topic", e);
            throw new ConflictException("Failed to refresh: AI service unavailable");
        }

        if (scored == null) {
            throw new ConflictException("No response from AI service");
        }

        // Update content
        contentJson.put("items", scored.getOrDefault("items", items));
        String overallCompleteness = (String) scored.getOrDefault("overall_completeness", "none");

        topic.setContentJson(toJsonString(contentJson));
        topic.setOverallCompleteness(CompletenessLevel.fromValue(overallCompleteness));
        topic.setLastRefreshedAt(LocalDateTime.now());
        topic.setLastUpdatedBy(settingsService.getDisplayName());

        ResearchTopic saved = researchTopicRepository.save(topic);
        return toResponse(saved);
    }

    public List<ResearchTopicResponse> refreshAll(UUID clusterId) {
        List<ResearchTopic> topics = researchTopicRepository.findByClusterIdOrderBySortOrder(clusterId);
        return topics.stream()
                .map(t -> refresh(t.getId()))
                .collect(Collectors.toList());
    }

    public ResearchTopicResponse expandBullet(UUID topicId, String bulletId) {
        ResearchTopic topic = researchTopicRepository.findById(topicId)
                .orElseThrow(() -> new ResourceNotFoundException("Research topic not found: " + topicId));

        Cluster cluster = clusterRepository.findById(topic.getClusterId())
                .orElseThrow(() -> new ResourceNotFoundException("Cluster not found"));
        Brain brain = brainRepository.findById(topic.getBrainId())
                .orElseThrow(() -> new ResourceNotFoundException("Brain not found"));

        Map<String, Object> contentJson = parseContentJson(topic.getContentJson());

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> items = (List<Map<String, Object>>) contentJson.getOrDefault("items", List.of());

        Map<String, Object> bullet = findBulletById(items, bulletId);
        if (bullet == null) {
            throw new ResourceNotFoundException("Bullet not found: " + bulletId);
        }

        List<Map<String, Object>> neuronSummaries = buildNeuronSummaries(brain.getId());

        Map<String, Object> expanded;
        try {
            expanded = intelligenceService.expandBullet(
                    bullet, topic.getTitle(), cluster.getResearchGoal(), brain.getName(), neuronSummaries);
        } catch (RestClientException e) {
            logger.error("Failed to expand bullet", e);
            throw new ConflictException("Failed to expand: AI service unavailable");
        }

        if (expanded == null) {
            throw new ConflictException("No response from AI service");
        }

        // Update the bullet's children in the tree
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> newChildren = (List<Map<String, Object>>) expanded.getOrDefault("children", List.of());
        bullet.put("children", newChildren);

        contentJson.put("items", items);
        topic.setContentJson(toJsonString(contentJson));
        topic.setLastUpdatedBy(settingsService.getDisplayName());

        ResearchTopic saved = researchTopicRepository.save(topic);
        return toResponse(saved);
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

    @SuppressWarnings("unchecked")
    private Map<String, Object> findBulletById(List<Map<String, Object>> items, String bulletId) {
        for (Map<String, Object> item : items) {
            if (bulletId.equals(item.get("id"))) {
                return item;
            }
            List<Map<String, Object>> children = (List<Map<String, Object>>) item.getOrDefault("children", List.of());
            Map<String, Object> found = findBulletById(children, bulletId);
            if (found != null) return found;
        }
        return null;
    }

    private Map<String, Object> parseContentJson(String json) {
        if (json == null || json.isBlank()) {
            return new HashMap<>(Map.of("version", 1, "items", List.of()));
        }
        try {
            return objectMapper.readValue(json, new TypeReference<>() {});
        } catch (JsonProcessingException e) {
            logger.warn("Failed to parse research topic content JSON", e);
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

    private ResearchTopicResponse toResponse(ResearchTopic topic) {
        Map<String, Object> contentJson = parseContentJson(topic.getContentJson());
        return new ResearchTopicResponse(
                topic.getId(),
                topic.getCluster() != null ? topic.getCluster().getId() : topic.getClusterId(),
                topic.getBrain() != null ? topic.getBrain().getId() : topic.getBrainId(),
                topic.getTitle(),
                topic.getPrompt(),
                contentJson,
                topic.getOverallCompleteness().getValue(),
                topic.getLastRefreshedAt(),
                topic.getSortOrder(),
                topic.getCreatedAt(),
                topic.getUpdatedAt(),
                topic.getCreatedBy(),
                topic.getLastUpdatedBy()
        );
    }
}
