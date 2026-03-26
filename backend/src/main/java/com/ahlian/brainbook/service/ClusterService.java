package com.ahlian.brainbook.service;

import com.ahlian.brainbook.dto.ClusterRequest;
import com.ahlian.brainbook.dto.ClusterResponse;
import com.ahlian.brainbook.dto.ReorderRequest;
import com.ahlian.brainbook.exception.ResourceNotFoundException;
import com.ahlian.brainbook.model.Brain;
import com.ahlian.brainbook.model.Cluster;
import com.ahlian.brainbook.repository.BrainRepository;
import com.ahlian.brainbook.repository.ClusterRepository;
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

    public ClusterService(ClusterRepository clusterRepository, BrainRepository brainRepository) {
        this.clusterRepository = clusterRepository;
        this.brainRepository = brainRepository;
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
        Brain brain = brainRepository.findById(req.getBrainId())
                .orElseThrow(() -> new ResourceNotFoundException("Brain not found: " + req.getBrainId()));

        Cluster cluster = new Cluster();
        cluster.setBrain(brain);
        cluster.setName(req.getName());
        cluster.setParentClusterId(req.getParentClusterId());
        cluster.setSortOrder(0);
        cluster.setArchived(false);
        Cluster saved = clusterRepository.save(cluster);
        return toResponse(saved);
    }

    public ClusterResponse update(UUID id, ClusterRequest req) {
        Cluster cluster = clusterRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Cluster not found: " + id));
        cluster.setName(req.getName());
        cluster.setParentClusterId(req.getParentClusterId());
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
        Cluster saved = clusterRepository.save(cluster);
        return toResponse(saved);
    }

    public ClusterResponse restore(UUID id) {
        Cluster cluster = clusterRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Cluster not found: " + id));
        cluster.setArchived(false);
        Cluster saved = clusterRepository.save(cluster);
        return toResponse(saved);
    }

    public void reorder(ReorderRequest req) {
        List<UUID> orderedIds = req.getOrderedIds();
        for (int i = 0; i < orderedIds.size(); i++) {
            UUID clusterId = orderedIds.get(i);
            Cluster cluster = clusterRepository.findById(clusterId)
                    .orElseThrow(() -> new ResourceNotFoundException("Cluster not found: " + clusterId));
            cluster.setSortOrder(i);
            clusterRepository.save(cluster);
        }
    }

    public ClusterResponse move(UUID id, UUID targetBrainId) {
        Cluster cluster = clusterRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Cluster not found: " + id));
        Brain targetBrain = brainRepository.findById(targetBrainId)
                .orElseThrow(() -> new ResourceNotFoundException("Brain not found: " + targetBrainId));
        cluster.setBrain(targetBrain);
        Cluster saved = clusterRepository.save(cluster);
        return toResponse(saved);
    }

    private ClusterResponse toResponse(Cluster cluster) {
        ClusterResponse resp = new ClusterResponse();
        resp.setId(cluster.getId());
        resp.setBrainId(cluster.getBrainId());
        resp.setName(cluster.getName());
        resp.setParentClusterId(cluster.getParentClusterId());
        resp.setSortOrder(cluster.getSortOrder());
        resp.setArchived(cluster.isArchived());
        resp.setCreatedAt(cluster.getCreatedAt());
        resp.setUpdatedAt(cluster.getUpdatedAt());
        return resp;
    }
}
