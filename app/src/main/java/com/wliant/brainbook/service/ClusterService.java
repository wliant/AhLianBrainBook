package com.wliant.brainbook.service;

import com.wliant.brainbook.dto.CreateClusterRequest;
import com.wliant.brainbook.dto.UpdateClusterRequest;
import com.wliant.brainbook.dto.ClusterResponse;
import com.wliant.brainbook.dto.ReorderRequest;
import com.wliant.brainbook.exception.ConflictException;
import com.wliant.brainbook.exception.ResourceNotFoundException;
import com.wliant.brainbook.config.SandboxGrpcClient;
import com.wliant.brainbook.model.Brain;
import com.wliant.brainbook.model.Cluster;
import com.wliant.brainbook.model.ClusterStatus;
import com.wliant.brainbook.model.ClusterType;
import com.wliant.brainbook.model.ProjectConfig;
import com.wliant.brainbook.repository.BrainRepository;
import com.wliant.brainbook.repository.ClusterRepository;
import com.wliant.brainbook.repository.NeuronRepository;
import com.wliant.brainbook.repository.ProjectConfigRepository;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@Transactional
public class ClusterService {

    private static final org.slf4j.Logger log = org.slf4j.LoggerFactory.getLogger(ClusterService.class);

    private final ClusterRepository clusterRepository;
    private final BrainRepository brainRepository;
    private final NeuronRepository neuronRepository;
    private final ProjectConfigRepository projectConfigRepository;
    private final SettingsService settingsService;
    private final ResearchAsyncService researchAsyncService;
    private final SandboxGrpcClient sandboxGrpcClient;

    public ClusterService(ClusterRepository clusterRepository, BrainRepository brainRepository,
                          NeuronRepository neuronRepository, ProjectConfigRepository projectConfigRepository,
                          SettingsService settingsService, ResearchAsyncService researchAsyncService,
                          SandboxGrpcClient sandboxGrpcClient) {
        this.clusterRepository = clusterRepository;
        this.brainRepository = brainRepository;
        this.neuronRepository = neuronRepository;
        this.projectConfigRepository = projectConfigRepository;
        this.settingsService = settingsService;
        this.researchAsyncService = researchAsyncService;
        this.sandboxGrpcClient = sandboxGrpcClient;
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

        String user = settingsService.getDisplayName();
        Cluster cluster = new Cluster();
        cluster.setBrain(brain);
        cluster.setName(req.name());
        cluster.setType(type);
        cluster.setSortOrder(0);
        cluster.setArchived(false);
        cluster.setCreatedBy(user);
        cluster.setLastUpdatedBy(user);

        // AI Research clusters start in GENERATING status
        if (type == ClusterType.AI_RESEARCH) {
            cluster.setStatus(ClusterStatus.GENERATING);
        } else {
            cluster.setStatus(ClusterStatus.READY);
        }

        // Auto-name todo clusters
        if (type == ClusterType.TODO) {
            cluster.setName("Tasks");
        }

        Cluster saved = clusterRepository.save(cluster);
        UUID savedId = saved.getId();

        // Create ProjectConfig for project clusters
        if (type == ClusterType.PROJECT) {
            if (req.repoUrl() == null || req.repoUrl().isBlank()) {
                throw new IllegalArgumentException("Repo URL is required for project clusters");
            }
            String defaultBranch = req.defaultBranch();
            if (defaultBranch == null || defaultBranch.isBlank()) {
                try {
                    defaultBranch = sandboxGrpcClient.detectDefaultBranch(req.repoUrl());
                    log.info("Detected default branch '{}' for {}", defaultBranch, req.repoUrl());
                } catch (Exception e) {
                    log.warn("Failed to detect default branch for {}, falling back to 'main': {}",
                            req.repoUrl(), e.getMessage());
                    defaultBranch = "main";
                }
            }
            ProjectConfig config = new ProjectConfig();
            config.setCluster(saved);
            config.setRepoUrl(req.repoUrl());
            config.setDefaultBranch(defaultBranch);
            projectConfigRepository.save(config);
        }

        // Kick off async research goal generation after transaction commits
        if (type == ClusterType.AI_RESEARCH) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    researchAsyncService.generateResearchGoalAsync(savedId);
                }
            });
        }

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

    private ClusterResponse toResponse(Cluster cluster) {
        return new ClusterResponse(
                cluster.getId(),
                cluster.getBrain() != null ? cluster.getBrain().getId() : cluster.getBrainId(),
                cluster.getName(),
                cluster.getType().getValue(),
                cluster.getStatus() != null ? cluster.getStatus().getValue() : "ready",
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
