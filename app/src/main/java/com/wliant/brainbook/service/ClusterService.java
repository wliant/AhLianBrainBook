package com.wliant.brainbook.service;

import com.wliant.brainbook.dto.ClusterRequest;
import com.wliant.brainbook.dto.ClusterResponse;
import com.wliant.brainbook.dto.ReorderRequest;
import com.wliant.brainbook.exception.ResourceNotFoundException;
import com.wliant.brainbook.model.Brain;
import com.wliant.brainbook.model.Cluster;
import com.wliant.brainbook.repository.BrainRepository;
import com.wliant.brainbook.repository.ClusterRepository;
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
    private final SettingsService settingsService;

    public ClusterService(ClusterRepository clusterRepository, BrainRepository brainRepository, SettingsService settingsService) {
        this.clusterRepository = clusterRepository;
        this.brainRepository = brainRepository;
        this.settingsService = settingsService;
    }

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

    public ClusterResponse create(ClusterRequest req) {
        Brain brain = brainRepository.findById(req.brainId())
                .orElseThrow(() -> new ResourceNotFoundException("Brain not found: " + req.brainId()));

        String user = settingsService.getDisplayName();
        Cluster cluster = new Cluster();
        cluster.setBrain(brain);
        cluster.setName(req.name());
        cluster.setParentClusterId(req.parentClusterId());
        cluster.setSortOrder(0);
        cluster.setArchived(false);
        cluster.setCreatedBy(user);
        cluster.setLastUpdatedBy(user);
        Cluster saved = clusterRepository.save(cluster);
        return toResponse(saved);
    }

    public ClusterResponse update(UUID id, ClusterRequest req) {
        Cluster cluster = clusterRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Cluster not found: " + id));
        cluster.setName(req.name());
        cluster.setParentClusterId(req.parentClusterId());
        cluster.setLastUpdatedBy(settingsService.getDisplayName());
        Cluster saved = clusterRepository.save(cluster);
        return toResponse(saved);
    }

    public void delete(UUID id) {
        Cluster cluster = clusterRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Cluster not found: " + id));
        clusterRepository.delete(cluster);
    }

    public ClusterResponse archive(UUID id) {
        Cluster cluster = clusterRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Cluster not found: " + id));
        cluster.setArchived(true);
        cluster.setLastUpdatedBy(settingsService.getDisplayName());
        Cluster saved = clusterRepository.save(cluster);
        return toResponse(saved);
    }

    public ClusterResponse restore(UUID id) {
        Cluster cluster = clusterRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Cluster not found: " + id));
        cluster.setArchived(false);
        cluster.setLastUpdatedBy(settingsService.getDisplayName());
        Cluster saved = clusterRepository.save(cluster);
        return toResponse(saved);
    }

    public void reorder(ReorderRequest req) {
        ReorderHelper.reorder(req, clusterRepository, Cluster::setSortOrder, "Cluster");
    }

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
                cluster.getParentClusterId(),
                cluster.getSortOrder(),
                cluster.isArchived(),
                cluster.getCreatedAt(),
                cluster.getUpdatedAt(),
                cluster.getCreatedBy(),
                cluster.getLastUpdatedBy()
        );
    }
}
