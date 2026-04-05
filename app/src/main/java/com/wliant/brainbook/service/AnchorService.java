package com.wliant.brainbook.service;

import com.wliant.brainbook.dto.CreateNeuronAnchorRequest;
import com.wliant.brainbook.dto.NeuronAnchorResponse;
import com.wliant.brainbook.dto.UpdateNeuronAnchorRequest;
import com.wliant.brainbook.exception.ConflictException;
import com.wliant.brainbook.exception.ResourceNotFoundException;
import com.wliant.brainbook.model.Cluster;
import com.wliant.brainbook.model.Neuron;
import com.wliant.brainbook.model.NeuronAnchor;
import com.wliant.brainbook.repository.ClusterRepository;
import com.wliant.brainbook.repository.NeuronAnchorRepository;
import com.wliant.brainbook.repository.NeuronRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@Transactional
public class AnchorService {

    private static final Logger logger = LoggerFactory.getLogger(AnchorService.class);

    private final NeuronAnchorRepository neuronAnchorRepository;
    private final NeuronRepository neuronRepository;
    private final ClusterRepository clusterRepository;

    public AnchorService(NeuronAnchorRepository neuronAnchorRepository,
                         NeuronRepository neuronRepository,
                         ClusterRepository clusterRepository) {
        this.neuronAnchorRepository = neuronAnchorRepository;
        this.neuronRepository = neuronRepository;
        this.clusterRepository = clusterRepository;
    }

    public NeuronAnchorResponse create(CreateNeuronAnchorRequest req) {
        Neuron neuron = neuronRepository.findById(req.neuronId())
                .orElseThrow(() -> new ResourceNotFoundException("Neuron not found: " + req.neuronId()));
        Cluster cluster = clusterRepository.findById(req.clusterId())
                .orElseThrow(() -> new ResourceNotFoundException("Cluster not found: " + req.clusterId()));

        if (neuronAnchorRepository.findByNeuronId(req.neuronId()).isPresent()) {
            throw new ConflictException("Neuron already has an anchor");
        }

        NeuronAnchor anchor = new NeuronAnchor();
        anchor.setNeuron(neuron);
        anchor.setCluster(cluster);
        anchor.setFilePath(req.filePath());

        NeuronAnchor saved = neuronAnchorRepository.save(anchor);
        return toResponse(saved);
    }

    public Page<NeuronAnchorResponse> listByCluster(UUID clusterId, Pageable pageable) {
        return neuronAnchorRepository.findByClusterId(clusterId, pageable)
                .map(this::toResponse);
    }

    public Page<NeuronAnchorResponse> listByFile(UUID clusterId, String filePath, Pageable pageable) {
        return neuronAnchorRepository.findByClusterIdAndFilePath(clusterId, filePath, pageable)
                .map(this::toResponse);
    }

    public NeuronAnchorResponse update(UUID id, UpdateNeuronAnchorRequest req) {
        NeuronAnchor anchor = neuronAnchorRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Anchor not found: " + id));

        anchor.setFilePath(req.filePath());

        NeuronAnchor saved = neuronAnchorRepository.save(anchor);
        return toResponse(saved);
    }

    public void delete(UUID id) {
        NeuronAnchor anchor = neuronAnchorRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Anchor not found: " + id));
        neuronAnchorRepository.delete(anchor);
    }

    public NeuronAnchorResponse getById(UUID id) {
        NeuronAnchor anchor = neuronAnchorRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Anchor not found: " + id));
        return toResponse(anchor);
    }

    public NeuronAnchorResponse getByNeuronId(UUID neuronId) {
        return neuronAnchorRepository.findByNeuronId(neuronId)
                .map(this::toResponse)
                .orElse(null);
    }

    public Map<UUID, NeuronAnchorResponse> getByNeuronIds(List<UUID> neuronIds) {
        if (neuronIds == null || neuronIds.isEmpty()) return Map.of();
        return neuronAnchorRepository.findByNeuronIdIn(neuronIds).stream()
                .collect(Collectors.toMap(
                        a -> a.getNeuron() != null ? a.getNeuron().getId() : a.getNeuronId(),
                        this::toResponse
                ));
    }

    private NeuronAnchorResponse toResponse(NeuronAnchor anchor) {
        return new NeuronAnchorResponse(
                anchor.getId(),
                anchor.getNeuron() != null ? anchor.getNeuron().getId() : anchor.getNeuronId(),
                anchor.getCluster() != null ? anchor.getCluster().getId() : anchor.getClusterId(),
                anchor.getFilePath(),
                anchor.getCreatedAt(),
                anchor.getUpdatedAt()
        );
    }
}
