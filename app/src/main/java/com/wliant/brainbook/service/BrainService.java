package com.wliant.brainbook.service;

import com.wliant.brainbook.dto.BrainRequest;
import com.wliant.brainbook.dto.BrainResponse;
import com.wliant.brainbook.dto.ReorderRequest;
import com.wliant.brainbook.exception.ResourceNotFoundException;
import com.wliant.brainbook.model.Brain;
import com.wliant.brainbook.repository.BrainRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@Transactional
public class BrainService {

    private final BrainRepository brainRepository;
    private final TagService tagService;

    public BrainService(BrainRepository brainRepository, TagService tagService) {
        this.brainRepository = brainRepository;
        this.tagService = tagService;
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
        brain.setName(req.name());
        brain.setIcon(req.icon());
        brain.setColor(req.color());
        brain.setDescription(req.description());
        brain.setSortOrder(0);
        brain.setArchived(false);
        Brain saved = brainRepository.save(brain);
        return toResponse(saved);
    }

    public BrainResponse update(UUID id, BrainRequest req) {
        Brain brain = brainRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Brain not found: " + id));
        brain.setName(req.name());
        brain.setIcon(req.icon());
        brain.setColor(req.color());
        brain.setDescription(req.description());
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
        ReorderHelper.reorder(req, brainRepository, Brain::setSortOrder, "Brain");
    }

    public BrainResponse toResponse(Brain brain) {
        return new BrainResponse(
                brain.getId(),
                brain.getName(),
                brain.getIcon(),
                brain.getColor(),
                brain.getDescription(),
                brain.getSortOrder(),
                brain.isArchived(),
                brain.getCreatedAt(),
                brain.getUpdatedAt(),
                tagService.getTagsForBrain(brain.getId())
        );
    }
}
