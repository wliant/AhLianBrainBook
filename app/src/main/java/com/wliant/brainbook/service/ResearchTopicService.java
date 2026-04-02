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
import com.wliant.brainbook.model.ResearchTopic;
import com.wliant.brainbook.model.ResearchTopicStatus;
import com.wliant.brainbook.repository.BrainRepository;
import com.wliant.brainbook.repository.ClusterRepository;
import com.wliant.brainbook.repository.NeuronRepository;
import com.wliant.brainbook.repository.ResearchTopicRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@Transactional
public class ResearchTopicService {

    private static final Logger logger = LoggerFactory.getLogger(ResearchTopicService.class);

    private final ResearchTopicRepository researchTopicRepository;
    private final ClusterRepository clusterRepository;
    private final BrainRepository brainRepository;
    private final ResearchAsyncService researchAsyncService;
    private final IntelligenceService intelligenceService;
    private final SettingsService settingsService;
    private final ObjectMapper objectMapper;
    private final TransactionTemplate transactionTemplate;

    public ResearchTopicService(ResearchTopicRepository researchTopicRepository,
                                 ClusterRepository clusterRepository,
                                 BrainRepository brainRepository,
                                 ResearchAsyncService researchAsyncService,
                                 IntelligenceService intelligenceService,
                                 SettingsService settingsService,
                                 ObjectMapper objectMapper,
                                 TransactionTemplate transactionTemplate) {
        this.researchTopicRepository = researchTopicRepository;
        this.clusterRepository = clusterRepository;
        this.brainRepository = brainRepository;
        this.researchAsyncService = researchAsyncService;
        this.intelligenceService = intelligenceService;
        this.settingsService = settingsService;
        this.objectMapper = objectMapper;
        this.transactionTemplate = transactionTemplate;
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

        String user = settingsService.getDisplayName();
        String prompt = req.prompt();

        // Create topic immediately with GENERATING status
        ResearchTopic topic = new ResearchTopic();
        topic.setCluster(cluster);
        topic.setBrain(cluster.getBrain());
        topic.setTitle(prompt != null && !prompt.isBlank() ? prompt : "Generating...");
        topic.setPrompt(prompt);
        topic.setStatus(ResearchTopicStatus.GENERATING);
        topic.setOverallCompleteness(CompletenessLevel.NONE);
        topic.setSortOrder(0);
        topic.setCreatedBy(user);
        topic.setLastUpdatedBy(user);

        ResearchTopic saved = researchTopicRepository.save(topic);
        UUID topicId = saved.getId();

        // Kick off async generation after transaction commits
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCommit() {
                researchAsyncService.generateTopicAsync(topicId, prompt, clusterId);
            }
        });

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

    public ResearchTopicResponse update(UUID topicId) {
        ResearchTopic topic = researchTopicRepository.findById(topicId)
                .orElseThrow(() -> new ResourceNotFoundException("Research topic not found: " + topicId));

        // Set UPDATING status and kick off async update
        topic.setStatus(ResearchTopicStatus.UPDATING);
        topic.setLastUpdatedBy(settingsService.getDisplayName());
        ResearchTopic saved = researchTopicRepository.save(topic);
        UUID savedId = saved.getId();
        UUID savedClusterId = saved.getCluster().getId();

        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCommit() {
                researchAsyncService.updateTopicAsync(savedId, savedClusterId);
            }
        });

        return toResponse(saved);
    }

    public List<ResearchTopicResponse> updateAll(UUID clusterId) {
        List<ResearchTopic> topics = researchTopicRepository.findByClusterIdOrderBySortOrder(clusterId);
        return topics.stream()
                .filter(t -> t.getStatus() == ResearchTopicStatus.READY)
                .map(t -> update(t.getId()))
                .collect(Collectors.toList());
    }

    private record ExpandContext(
            UUID topicId, String topicTitle, String researchGoal, String brainName,
            Map<String, Object> bullet, String bulletId, List<Map<String, Object>> neuronSummaries) {}

    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    public ResearchTopicResponse expandBullet(UUID topicId, String bulletId) {
        // Phase 1: Read data in a short transaction
        ExpandContext ctx = transactionTemplate.execute(status -> {
            ResearchTopic topic = researchTopicRepository.findById(topicId)
                    .orElseThrow(() -> new ResourceNotFoundException("Research topic not found: " + topicId));
            Cluster cluster = clusterRepository.findById(topic.getCluster().getId())
                    .orElseThrow(() -> new ResourceNotFoundException("Cluster not found"));
            Brain brain = brainRepository.findById(topic.getBrain().getId())
                    .orElseThrow(() -> new ResourceNotFoundException("Brain not found"));

            Map<String, Object> contentJson = parseContentJson(topic.getContentJson());
            @SuppressWarnings("unchecked")
            List<Map<String, Object>> items = (List<Map<String, Object>>) contentJson.getOrDefault("items", List.of());
            Map<String, Object> bullet = findBulletById(items, bulletId);
            if (bullet == null) {
                throw new ResourceNotFoundException("Bullet not found: " + bulletId);
            }

            List<Map<String, Object>> neuronSummaries = researchAsyncService.buildNeuronSummaries(brain.getId());

            return new ExpandContext(topicId, topic.getTitle(), cluster.getResearchGoal(),
                    brain.getName(), bullet, bulletId, neuronSummaries);
        });

        // Phase 2: Call intelligence service — NO transaction held
        Map<String, Object> expanded;
        try {
            expanded = intelligenceService.expandBullet(
                    ctx.bullet(), ctx.topicTitle(), ctx.researchGoal(), ctx.brainName(), ctx.neuronSummaries());
        } catch (Exception e) {
            logger.error("Failed to expand bullet", e);
            throw new ConflictException("Failed to expand: AI service unavailable");
        }

        if (expanded == null) {
            throw new ConflictException("No response from AI service");
        }

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> newChildren = (List<Map<String, Object>>) expanded.getOrDefault("children", List.of());

        // Phase 3: Re-read topic and apply changes in a short transaction
        return transactionTemplate.execute(status -> {
            ResearchTopic freshTopic = researchTopicRepository.findById(topicId)
                    .orElseThrow(() -> new ResourceNotFoundException("Research topic not found: " + topicId));

            Map<String, Object> freshContentJson = parseContentJson(freshTopic.getContentJson());
            @SuppressWarnings("unchecked")
            List<Map<String, Object>> freshItems = (List<Map<String, Object>>) freshContentJson.getOrDefault("items", List.of());
            Map<String, Object> freshBullet = findBulletById(freshItems, bulletId);
            if (freshBullet != null) {
                freshBullet.put("children", newChildren);
            }

            freshContentJson.put("items", freshItems);
            freshTopic.setContentJson(toJsonString(freshContentJson));
            freshTopic.setLastUpdatedBy(settingsService.getDisplayName());

            ResearchTopic saved = researchTopicRepository.save(freshTopic);
            return toResponse(saved);
        });
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
                topic.getStatus().getValue(),
                topic.getLastRefreshedAt(),
                topic.getSortOrder(),
                topic.getCreatedAt(),
                topic.getUpdatedAt(),
                topic.getCreatedBy(),
                topic.getLastUpdatedBy()
        );
    }
}
