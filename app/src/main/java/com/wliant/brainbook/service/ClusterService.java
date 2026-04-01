package com.wliant.brainbook.service;

import com.wliant.brainbook.dto.ClusterRequest;
import com.wliant.brainbook.dto.ClusterResponse;
import com.wliant.brainbook.dto.ReorderRequest;
import com.wliant.brainbook.exception.ConflictException;
import com.wliant.brainbook.exception.ResourceNotFoundException;
import com.wliant.brainbook.model.Brain;
import com.wliant.brainbook.model.Cluster;
import com.wliant.brainbook.repository.BrainRepository;
import com.wliant.brainbook.repository.ClusterRepository;
import com.wliant.brainbook.repository.NeuronRepository;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@Transactional
public class ClusterService {

    private final ClusterRepository clusterRepository;
    private final BrainRepository brainRepository;
    private final NeuronRepository neuronRepository;
    private final SettingsService settingsService;

    public ClusterService(ClusterRepository clusterRepository, BrainRepository brainRepository,
                          NeuronRepository neuronRepository, SettingsService settingsService) {
        this.clusterRepository = clusterRepository;
        this.brainRepository = brainRepository;
        this.neuronRepository = neuronRepository;
        this.settingsService = settingsService;
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
    public ClusterResponse create(ClusterRequest req) {
        Brain brain = brainRepository.findById(req.brainId())
                .orElseThrow(() -> new ResourceNotFoundException("Brain not found: " + req.brainId()));

        String user = settingsService.getDisplayName();
        Cluster cluster = new Cluster();
        cluster.setBrain(brain);
        cluster.setName(req.name());
        cluster.setSortOrder(0);
        cluster.setArchived(false);
        cluster.setCreatedBy(user);
        cluster.setLastUpdatedBy(user);
        Cluster saved = clusterRepository.save(cluster);
        return toResponse(saved);
    }

    @CacheEvict(value = "clustersByBrain", allEntries = true)
    public ClusterResponse update(UUID id, ClusterRequest req) {
        Cluster cluster = clusterRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Cluster not found: " + id));

        cluster.setName(req.name());
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
        cluster.setBrain(targetBrain);
        cluster.setLastUpdatedBy(settingsService.getDisplayName());
        Cluster saved = clusterRepository.save(cluster);
        return toResponse(saved);
    }

    private ClusterResponse toResponse(Cluster cluster) {
        return new ClusterResponse(
                cluster.getId(),
                cluster.getBrain() != null ? cluster.getBrain().getId() : cluster.getBrainId(),
                cluster.getName(),
                cluster.getSortOrder(),
                cluster.isArchived(),
                cluster.getCreatedAt(),
                cluster.getUpdatedAt(),
                cluster.getCreatedBy(),
                cluster.getLastUpdatedBy()
        );
    }
}
