package com.ahlian.brainbook.service;

import com.ahlian.brainbook.dto.MoveNeuronRequest;
import com.ahlian.brainbook.dto.NeuronContentRequest;
import com.ahlian.brainbook.dto.NeuronRequest;
import com.ahlian.brainbook.dto.NeuronResponse;
import com.ahlian.brainbook.dto.ReorderRequest;
import com.ahlian.brainbook.dto.TagResponse;
import com.ahlian.brainbook.exception.ConflictException;
import com.ahlian.brainbook.exception.ResourceNotFoundException;
import com.ahlian.brainbook.model.Brain;
import com.ahlian.brainbook.model.Cluster;
import com.ahlian.brainbook.model.Neuron;
import com.ahlian.brainbook.repository.BrainRepository;
import com.ahlian.brainbook.repository.ClusterRepository;
import com.ahlian.brainbook.repository.NeuronRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Collections;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@Transactional
public class NeuronService {

    private final NeuronRepository neuronRepository;
    private final BrainRepository brainRepository;
    private final ClusterRepository clusterRepository;
    private final TagService tagService;

    public NeuronService(NeuronRepository neuronRepository,
                         BrainRepository brainRepository,
                         ClusterRepository clusterRepository,
                         TagService tagService) {
        this.neuronRepository = neuronRepository;
        this.brainRepository = brainRepository;
        this.clusterRepository = clusterRepository;
        this.tagService = tagService;
    }

    public List<NeuronResponse> getByClusterId(UUID clusterId) {
        return neuronRepository.findByClusterIdAndIsDeletedFalseAndIsArchivedFalseOrderBySortOrderAsc(clusterId)
                .stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    public NeuronResponse getById(UUID id) {
        Neuron neuron = neuronRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Neuron not found: " + id));
        return toResponse(neuron);
    }

    public List<NeuronResponse> getRecent(int limit) {
        Page<Neuron> page = neuronRepository.findByIsDeletedFalseAndIsArchivedFalseOrderByLastEditedAtDesc(
                PageRequest.of(0, limit));
        return page.getContent().stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    public List<NeuronResponse> getFavorites() {
        return neuronRepository.findByIsFavoriteTrueAndIsDeletedFalseOrderByUpdatedAtDesc().stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    public List<NeuronResponse> getPinned() {
        return neuronRepository.findByIsPinnedTrueAndIsDeletedFalseOrderByUpdatedAtDesc().stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    public NeuronResponse create(NeuronRequest req) {
        Brain brain = brainRepository.findById(req.getBrainId())
                .orElseThrow(() -> new ResourceNotFoundException("Brain not found: " + req.getBrainId()));
        Cluster cluster = clusterRepository.findById(req.getClusterId())
                .orElseThrow(() -> new ResourceNotFoundException("Cluster not found: " + req.getClusterId()));

        Neuron neuron = new Neuron();
        neuron.setBrain(brain);
        neuron.setCluster(cluster);
        neuron.setTitle(req.getTitle());
        neuron.setContentJson(req.getContentJson());
        neuron.setContentText(req.getContentText());
        neuron.setTemplateId(req.getTemplateId());
        neuron.setSortOrder(0);
        neuron.setFavorite(false);
        neuron.setPinned(false);
        neuron.setArchived(false);
        neuron.setDeleted(false);
        neuron.setVersion(1);

        Neuron saved = neuronRepository.save(neuron);
        return toResponse(saved);
    }

    public NeuronResponse update(UUID id, NeuronRequest req) {
        Neuron neuron = neuronRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Neuron not found: " + id));
        neuron.setTitle(req.getTitle());
        neuron.setContentJson(req.getContentJson());
        neuron.setContentText(req.getContentText());
        neuron.setTemplateId(req.getTemplateId());
        neuron.setLastEditedAt(LocalDateTime.now());
        Neuron saved = neuronRepository.save(neuron);
        return toResponse(saved);
    }

    public NeuronResponse updateContent(UUID id, NeuronContentRequest req) {
        Neuron neuron = neuronRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Neuron not found: " + id));

        if (neuron.getVersion() != req.getExpectedVersion()) {
            throw new ConflictException("Version conflict: expected " + req.getExpectedVersion()
                    + " but found " + neuron.getVersion());
        }

        neuron.setContentJson(req.getContentJson());
        neuron.setContentText(req.getContentText());
        neuron.setVersion(neuron.getVersion() + 1);
        neuron.setLastEditedAt(LocalDateTime.now());
        Neuron saved = neuronRepository.save(neuron);
        return toResponse(saved);
    }

    public void delete(UUID id) {
        Neuron neuron = neuronRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Neuron not found: " + id));
        neuron.setDeleted(true);
        neuronRepository.save(neuron);
    }

    public NeuronResponse archive(UUID id) {
        Neuron neuron = neuronRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Neuron not found: " + id));
        neuron.setArchived(true);
        Neuron saved = neuronRepository.save(neuron);
        return toResponse(saved);
    }

    public NeuronResponse restore(UUID id) {
        Neuron neuron = neuronRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Neuron not found: " + id));
        neuron.setArchived(false);
        Neuron saved = neuronRepository.save(neuron);
        return toResponse(saved);
    }

    public NeuronResponse move(UUID id, MoveNeuronRequest req) {
        Neuron neuron = neuronRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Neuron not found: " + id));
        Brain brain = brainRepository.findById(req.getBrainId())
                .orElseThrow(() -> new ResourceNotFoundException("Brain not found: " + req.getBrainId()));
        Cluster cluster = clusterRepository.findById(req.getClusterId())
                .orElseThrow(() -> new ResourceNotFoundException("Cluster not found: " + req.getClusterId()));

        neuron.setBrain(brain);
        neuron.setCluster(cluster);
        Neuron saved = neuronRepository.save(neuron);
        return toResponse(saved);
    }

    public NeuronResponse duplicate(UUID id) {
        Neuron original = neuronRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Neuron not found: " + id));

        Neuron copy = new Neuron();
        copy.setBrain(original.getBrain());
        copy.setCluster(original.getCluster());
        copy.setTitle(original.getTitle() + " (copy)");
        copy.setContentJson(original.getContentJson());
        copy.setContentText(original.getContentText());
        copy.setTemplateId(original.getTemplateId());
        copy.setSortOrder(original.getSortOrder() + 1);
        copy.setFavorite(false);
        copy.setPinned(false);
        copy.setArchived(false);
        copy.setDeleted(false);
        copy.setVersion(1);

        Neuron saved = neuronRepository.save(copy);
        return toResponse(saved);
    }

    public NeuronResponse toggleFavorite(UUID id) {
        Neuron neuron = neuronRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Neuron not found: " + id));
        neuron.setFavorite(!neuron.isFavorite());
        Neuron saved = neuronRepository.save(neuron);
        return toResponse(saved);
    }

    public NeuronResponse togglePin(UUID id) {
        Neuron neuron = neuronRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Neuron not found: " + id));
        neuron.setPinned(!neuron.isPinned());
        Neuron saved = neuronRepository.save(neuron);
        return toResponse(saved);
    }

    public void reorder(ReorderRequest req) {
        List<UUID> orderedIds = req.getOrderedIds();
        for (int i = 0; i < orderedIds.size(); i++) {
            UUID neuronId = orderedIds.get(i);
            Neuron neuron = neuronRepository.findById(neuronId)
                    .orElseThrow(() -> new ResourceNotFoundException("Neuron not found: " + neuronId));
            neuron.setSortOrder(i);
            neuronRepository.save(neuron);
        }
    }

    public List<NeuronResponse> getTrash() {
        return neuronRepository.findByIsDeletedTrueOrderByUpdatedAtDesc().stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    public NeuronResponse restoreFromTrash(UUID id) {
        Neuron neuron = neuronRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Neuron not found: " + id));
        neuron.setDeleted(false);
        Neuron saved = neuronRepository.save(neuron);
        return toResponse(saved);
    }

    public void permanentDelete(UUID id) {
        Neuron neuron = neuronRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Neuron not found: " + id));
        neuronRepository.delete(neuron);
    }

    private NeuronResponse toResponse(Neuron neuron) {
        NeuronResponse resp = new NeuronResponse();
        resp.setId(neuron.getId());
        resp.setBrainId(neuron.getBrainId());
        resp.setClusterId(neuron.getClusterId());
        resp.setTitle(neuron.getTitle());
        resp.setContentJson(neuron.getContentJson());
        resp.setContentText(neuron.getContentText());
        resp.setTemplateId(neuron.getTemplateId());
        resp.setArchived(neuron.isArchived());
        resp.setDeleted(neuron.isDeleted());
        resp.setFavorite(neuron.isFavorite());
        resp.setPinned(neuron.isPinned());
        resp.setVersion(neuron.getVersion());
        resp.setSortOrder(neuron.getSortOrder());
        resp.setCreatedAt(neuron.getCreatedAt());
        resp.setUpdatedAt(neuron.getUpdatedAt());
        resp.setLastEditedAt(neuron.getLastEditedAt());

        try {
            List<TagResponse> tags = tagService.getTagsForNeuron(neuron.getId());
            resp.setTags(tags);
        } catch (Exception e) {
            resp.setTags(Collections.emptyList());
        }

        return resp;
    }
}
