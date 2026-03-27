package com.ahlian.brainbook.service;

import com.ahlian.brainbook.dto.BrainRequest;
import com.ahlian.brainbook.dto.BrainResponse;
import com.ahlian.brainbook.dto.ReorderRequest;
import com.ahlian.brainbook.exception.ResourceNotFoundException;
import com.ahlian.brainbook.model.Brain;
import com.ahlian.brainbook.repository.BrainRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@Transactional
public class BrainService {

    private final BrainRepository brainRepository;

    public BrainService(BrainRepository brainRepository) {
        this.brainRepository = brainRepository;
    }

    public List<BrainResponse> getAll() {
        return brainRepository.findByIsArchivedFalseOrderBySortOrder().stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    public BrainResponse getById(UUID id) {
        Brain brain = brainRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Brain not found: " + id));
        return toResponse(brain);
    }

    public BrainResponse create(BrainRequest req) {
        Brain brain = new Brain();
        brain.setName(req.getName());
        brain.setIcon(req.getIcon());
        brain.setColor(req.getColor());
        brain.setSortOrder(0);
        brain.setArchived(false);
        Brain saved = brainRepository.save(brain);
        return toResponse(saved);
    }

    public BrainResponse update(UUID id, BrainRequest req) {
        Brain brain = brainRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Brain not found: " + id));
        brain.setName(req.getName());
        brain.setIcon(req.getIcon());
        brain.setColor(req.getColor());
        Brain saved = brainRepository.save(brain);
        return toResponse(saved);
    }

    public void delete(UUID id) {
        Brain brain = brainRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Brain not found: " + id));
        brainRepository.delete(brain);
    }

    public BrainResponse archive(UUID id) {
        Brain brain = brainRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Brain not found: " + id));
        brain.setArchived(true);
        Brain saved = brainRepository.save(brain);
        return toResponse(saved);
    }

    public BrainResponse restore(UUID id) {
        Brain brain = brainRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Brain not found: " + id));
        brain.setArchived(false);
        Brain saved = brainRepository.save(brain);
        return toResponse(saved);
    }

    public void reorder(ReorderRequest req) {
        List<UUID> orderedIds = req.getOrderedIds();
        for (int i = 0; i < orderedIds.size(); i++) {
            UUID brainId = orderedIds.get(i);
            Brain brain = brainRepository.findById(brainId)
                    .orElseThrow(() -> new ResourceNotFoundException("Brain not found: " + brainId));
            brain.setSortOrder(i);
            brainRepository.save(brain);
        }
    }

    public BrainResponse toResponse(Brain brain) {
        BrainResponse resp = new BrainResponse();
        resp.setId(brain.getId());
        resp.setName(brain.getName());
        resp.setIcon(brain.getIcon());
        resp.setColor(brain.getColor());
        resp.setSortOrder(brain.getSortOrder());
        resp.setArchived(brain.isArchived());
        resp.setCreatedAt(brain.getCreatedAt());
        resp.setUpdatedAt(brain.getUpdatedAt());
        return resp;
    }
}
