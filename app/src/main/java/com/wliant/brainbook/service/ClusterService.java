package com.wliant.brainbook.service;

import com.wliant.brainbook.dto.CreateClusterRequest;
import com.wliant.brainbook.dto.UpdateClusterRequest;
import com.wliant.brainbook.dto.ClusterResponse;
import com.wliant.brainbook.dto.ReorderRequest;
import com.wliant.brainbook.exception.ConflictException;
import com.wliant.brainbook.exception.ResourceNotFoundException;
import com.wliant.brainbook.model.Brain;
import com.wliant.brainbook.model.Cluster;
import com.wliant.brainbook.model.ClusterType;
import com.wliant.brainbook.repository.BrainRepository;
import com.wliant.brainbook.repository.ClusterRepository;
import com.wliant.brainbook.repository.NeuronRepository;
import com.wliant.brainbook.model.Neuron;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@Transactional
public class ClusterService {

    private static final Logger logger = LoggerFactory.getLogger(ClusterService.class);
    private static final int CONTENT_PREVIEW_LENGTH = 500;

    private final ClusterRepository clusterRepository;
    private final BrainRepository brainRepository;
    private final NeuronRepository neuronRepository;
    private final SettingsService settingsService;
    private final IntelligenceService intelligenceService;

    public ClusterService(ClusterRepository clusterRepository, BrainRepository brainRepository,
                          NeuronRepository neuronRepository, SettingsService settingsService,
                          IntelligenceService intelligenceService) {
        this.clusterRepository = clusterRepository;
        this.brainRepository = brainRepository;
        this.neuronRepository = neuronRepository;
        this.settingsService = settingsService;
        this.intelligenceService = intelligenceService;
    }

    @Cacheable(value = "clustersByBrain", key = "#brainId")
    public List<ClusterResponse> getByBrainId(UUID brainId) {
        return clusterRepository.findByBrainIdAndIsArchivedFalseOrderBySortOrder(brainId).stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    public ClusterResponse getById(UUID id) {
        Cluster cluster = clusterRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Cluster not found: " + id));
        return toResponse(cluster);
    }

    @CacheEvict(value = "clustersByBrain", allEntries = true)
    public ClusterResponse create(CreateClusterRequest req) {
        Brain brain = brainRepository.findById(req.brainId())
                .orElseThrow(() -> new ResourceNotFoundException("Brain not found: " + req.brainId()));

        ClusterType type = req.type() != null ? ClusterType.fromValue(req.type()) : ClusterType.KNOWLEDGE;
        if (type.isUnique()) {
            validateUniqueType(req.brainId(), type);
        }

        // Generate research goal for AI Research clusters
        String researchGoal = null;
        if (type == ClusterType.AI_RESEARCH) {
            try {
                List<Map<String, Object>> neuronSummaries = buildNeuronSummaries(req.brainId());
                researchGoal = intelligenceService.generateResearchGoal(brain.getName(), neuronSummaries);
            } catch (Exception e) {
                logger.warn("Failed to generate research goal, continuing with empty goal", e);
            }
        }

        String user = settingsService.getDisplayName();
        Cluster cluster = new Cluster();
        cluster.setBrain(brain);
        cluster.setName(req.name());
        cluster.setType(type);
        cluster.setResearchGoal(researchGoal);
        cluster.setSortOrder(0);
        cluster.setArchived(false);
        cluster.setCreatedBy(user);
        cluster.setLastUpdatedBy(user);
        Cluster saved = clusterRepository.save(cluster);
        return toResponse(saved);
    }

    @CacheEvict(value = "clustersByBrain", allEntries = true)
    public ClusterResponse update(UUID id, UpdateClusterRequest req) {
        Cluster cluster = clusterRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Cluster not found: " + id));

        cluster.setName(req.name());
        if (req.researchGoal() != null && cluster.getType() == ClusterType.AI_RESEARCH) {
            cluster.setResearchGoal(req.researchGoal());
        }
        cluster.setLastUpdatedBy(settingsService.getDisplayName());
        Cluster saved = clusterRepository.save(cluster);
        return toResponse(saved);
    }

    @CacheEvict(value = "clustersByBrain", allEntries = true)
    public void delete(UUID id) {
        Cluster cluster = clusterRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Cluster not found: " + id));
        long neuronCount = neuronRepository.countByClusterIdAndIsDeletedFalse(id);
        if (neuronCount > 0) {
            throw new ConflictException("Cannot delete cluster with " + neuronCount + " active neuron(s). Move or delete them first.");
        }
        clusterRepository.delete(cluster);
    }

    @CacheEvict(value = "clustersByBrain", allEntries = true)
    public ClusterResponse archive(UUID id) {
        Cluster cluster = clusterRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Cluster not found: " + id));
        cluster.setArchived(true);
        cluster.setLastUpdatedBy(settingsService.getDisplayName());
        Cluster saved = clusterRepository.save(cluster);
        return toResponse(saved);
    }

    @CacheEvict(value = "clustersByBrain", allEntries = true)
    public ClusterResponse restore(UUID id) {
        Cluster cluster = clusterRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Cluster not found: " + id));
        if (cluster.getType().isUnique()) {
            validateUniqueType(cluster.getBrain().getId(), cluster.getType());
        }
        cluster.setArchived(false);
        cluster.setLastUpdatedBy(settingsService.getDisplayName());
        Cluster saved = clusterRepository.save(cluster);
        return toResponse(saved);
    }

    @CacheEvict(value = "clustersByBrain", allEntries = true)
    public void reorder(ReorderRequest req) {
        ReorderHelper.reorder(req, clusterRepository, Cluster::setSortOrder, "Cluster");
    }

    @CacheEvict(value = "clustersByBrain", allEntries = true)
    public ClusterResponse move(UUID id, UUID targetBrainId) {
        Cluster cluster = clusterRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Cluster not found: " + id));
        Brain targetBrain = brainRepository.findById(targetBrainId)
                .orElseThrow(() -> new ResourceNotFoundException("Brain not found: " + targetBrainId));
        if (cluster.getType().isUnique()) {
            validateUniqueType(targetBrainId, cluster.getType());
        }
        cluster.setBrain(targetBrain);
        cluster.setLastUpdatedBy(settingsService.getDisplayName());
        Cluster saved = clusterRepository.save(cluster);
        return toResponse(saved);
    }

    private void validateUniqueType(UUID brainId, ClusterType type) {
        long count = clusterRepository.countByBrainIdAndTypeAndIsArchivedFalse(brainId, type);
        if (count > 0) {
            throw new ConflictException("Only one " + type.getValue() + " cluster allowed per brain");
        }
    }

    private List<Map<String, Object>> buildNeuronSummaries(UUID brainId) {
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

    private ClusterResponse toResponse(Cluster cluster) {
        return new ClusterResponse(
                cluster.getId(),
                cluster.getBrain() != null ? cluster.getBrain().getId() : cluster.getBrainId(),
                cluster.getName(),
                cluster.getType().getValue(),
                cluster.getResearchGoal(),
                cluster.getSortOrder(),
                cluster.isArchived(),
                cluster.getCreatedAt(),
                cluster.getUpdatedAt(),
                cluster.getCreatedBy(),
                cluster.getLastUpdatedBy()
        );
    }
}
