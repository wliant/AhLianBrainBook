package com.wliant.brainbook.service;

import com.wliant.brainbook.dto.BrainRequest;
import com.wliant.brainbook.dto.BrainResponse;
import com.wliant.brainbook.dto.ReorderRequest;
import com.wliant.brainbook.dto.TagResponse;
import com.wliant.brainbook.exception.ResourceNotFoundException;
import com.wliant.brainbook.model.Brain;
import com.wliant.brainbook.repository.BrainRepository;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@Transactional
public class BrainService {

    private final BrainRepository brainRepository;
    private final TagService tagService;
    private final SettingsService settingsService;

    public BrainService(BrainRepository brainRepository, TagService tagService, SettingsService settingsService) {
        this.brainRepository = brainRepository;
        this.tagService = tagService;
        this.settingsService = settingsService;
    }

    @Cacheable("brains")
    public List<BrainResponse> getAll() {
        List<Brain> brains = brainRepository.findByIsArchivedFalseOrderBySortOrder();
        if (brains.isEmpty()) return List.of();

        List<UUID> brainIds = brains.stream().map(Brain::getId).collect(Collectors.toList());
        Map<UUID, List<TagResponse>> tagsByBrain = tagService.getTagsForBrains(brainIds);

        return brains.stream()
                .map(brain -> toResponseWithTags(brain, tagsByBrain.getOrDefault(brain.getId(), Collections.emptyList())))
                .collect(Collectors.toList());
    }

    public BrainResponse getById(UUID id) {
        Brain brain = brainRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Brain not found: " + id));
        return toResponse(brain);
    }

    @CacheEvict(value = "brains", allEntries = true)
    public BrainResponse create(BrainRequest req) {
        String user = settingsService.getDisplayName();
        Brain brain = new Brain();
        brain.setName(req.name());
        brain.setIcon(req.icon());
        brain.setColor(req.color());
        brain.setDescription(req.description());
        brain.setSortOrder(0);
        brain.setArchived(false);
        brain.setCreatedBy(user);
        brain.setLastUpdatedBy(user);
        Brain saved = brainRepository.save(brain);
        return toResponse(saved);
    }

    @CacheEvict(value = "brains", allEntries = true)
    public BrainResponse update(UUID id, BrainRequest req) {
        Brain brain = brainRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Brain not found: " + id));
        brain.setName(req.name());
        brain.setIcon(req.icon());
        brain.setColor(req.color());
        brain.setDescription(req.description());
        brain.setLastUpdatedBy(settingsService.getDisplayName());
        Brain saved = brainRepository.save(brain);
        return toResponse(saved);
    }

    @CacheEvict(value = "brains", allEntries = true)
    public void delete(UUID id) {
        Brain brain = brainRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Brain not found: " + id));
        brainRepository.delete(brain);
    }

    @CacheEvict(value = "brains", allEntries = true)
    public BrainResponse archive(UUID id) {
        Brain brain = brainRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Brain not found: " + id));
        brain.setArchived(true);
        brain.setLastUpdatedBy(settingsService.getDisplayName());
        Brain saved = brainRepository.save(brain);
        return toResponse(saved);
    }

    @CacheEvict(value = "brains", allEntries = true)
    public BrainResponse restore(UUID id) {
        Brain brain = brainRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Brain not found: " + id));
        brain.setArchived(false);
        brain.setLastUpdatedBy(settingsService.getDisplayName());
        Brain saved = brainRepository.save(brain);
        return toResponse(saved);
    }

    @CacheEvict(value = "brains", allEntries = true)
    public void reorder(ReorderRequest req) {
        ReorderHelper.reorder(req, brainRepository, Brain::setSortOrder, "Brain");
    }

    public BrainResponse toResponse(Brain brain) {
        return toResponseWithTags(brain, tagService.getTagsForBrain(brain.getId()));
    }

    private BrainResponse toResponseWithTags(Brain brain, List<TagResponse> tags) {
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
                brain.getCreatedBy(),
                brain.getLastUpdatedBy(),
                tags
        );
    }
}
