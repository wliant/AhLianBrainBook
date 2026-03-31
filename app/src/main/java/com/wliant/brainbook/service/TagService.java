package com.wliant.brainbook.service;

import com.wliant.brainbook.dto.TagRequest;
import com.wliant.brainbook.dto.TagResponse;
import com.wliant.brainbook.exception.ConflictException;
import com.wliant.brainbook.exception.ResourceNotFoundException;
import com.wliant.brainbook.model.Tag;
import com.wliant.brainbook.repository.BrainRepository;
import com.wliant.brainbook.repository.NeuronRepository;
import com.wliant.brainbook.repository.TagRepository;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.sql.Timestamp;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@Transactional
public class TagService {

    private final TagRepository tagRepository;
    private final NeuronRepository neuronRepository;
    private final BrainRepository brainRepository;

    @PersistenceContext
    private EntityManager entityManager;

    public TagService(TagRepository tagRepository, NeuronRepository neuronRepository, BrainRepository brainRepository) {
        this.tagRepository = tagRepository;
        this.neuronRepository = neuronRepository;
        this.brainRepository = brainRepository;
    }

    @Cacheable("tags")
    public List<TagResponse> getAll() {
        return tagRepository.findAll().stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    public List<TagResponse> search(String query) {
        return tagRepository.findByNameContainingIgnoreCase(query).stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    @CacheEvict(value = "tags", allEntries = true)
    public TagResponse create(TagRequest req) {
        Tag tag = new Tag();
        tag.setName(req.name());
        tag.setColor(req.color());
        Tag saved = tagRepository.save(tag);
        return toResponse(saved);
    }

    @CacheEvict(value = "tags", allEntries = true)
    public void delete(UUID id) {
        Tag tag = tagRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Tag not found: " + id));
        tagRepository.delete(tag);
    }

    public void addTagToNeuron(UUID neuronId, UUID tagId) {
        var neuron = neuronRepository.findById(neuronId)
                .orElseThrow(() -> new ResourceNotFoundException("Neuron not found: " + neuronId));
        if (neuron.isDeleted()) {
            throw new ConflictException("Cannot tag a deleted neuron");
        }
        tagRepository.findById(tagId)
                .orElseThrow(() -> new ResourceNotFoundException("Tag not found: " + tagId));

        entityManager.createNativeQuery(
                        "INSERT INTO neuron_tags (neuron_id, tag_id) VALUES (:neuronId, :tagId) ON CONFLICT DO NOTHING")
                .setParameter("neuronId", neuronId)
                .setParameter("tagId", tagId)
                .executeUpdate();
    }

    public void removeTagFromNeuron(UUID neuronId, UUID tagId) {
        entityManager.createNativeQuery(
                        "DELETE FROM neuron_tags WHERE neuron_id = :neuronId AND tag_id = :tagId")
                .setParameter("neuronId", neuronId)
                .setParameter("tagId", tagId)
                .executeUpdate();
    }

    @SuppressWarnings("unchecked")
    public List<TagResponse> getTagsForNeuron(UUID neuronId) {
        return getTagsForNeurons(List.of(neuronId)).getOrDefault(neuronId, Collections.emptyList());
    }

    public Map<UUID, List<TagResponse>> getTagsForNeurons(Collection<UUID> neuronIds) {
        if (neuronIds == null || neuronIds.isEmpty()) return Collections.emptyMap();

        List<Object[]> rows = tagRepository.findTagsWithNeuronIds(neuronIds);
        Map<UUID, List<TagResponse>> result = new HashMap<>();
        for (Object[] row : rows) {
            UUID neuronId = (UUID) row[0];
            TagResponse tag = new TagResponse(
                    (UUID) row[1],
                    (String) row[2],
                    (String) row[3],
                    ((Timestamp) row[4]).toLocalDateTime(),
                    ((Timestamp) row[5]).toLocalDateTime()
            );
            result.computeIfAbsent(neuronId, k -> new ArrayList<>()).add(tag);
        }
        return result;
    }

    public void addTagToBrain(UUID brainId, UUID tagId) {
        brainRepository.findById(brainId)
                .orElseThrow(() -> new ResourceNotFoundException("Brain not found: " + brainId));
        tagRepository.findById(tagId)
                .orElseThrow(() -> new ResourceNotFoundException("Tag not found: " + tagId));

        entityManager.createNativeQuery(
                        "INSERT INTO brain_tags (brain_id, tag_id) VALUES (:brainId, :tagId) ON CONFLICT DO NOTHING")
                .setParameter("brainId", brainId)
                .setParameter("tagId", tagId)
                .executeUpdate();
    }

    public void removeTagFromBrain(UUID brainId, UUID tagId) {
        entityManager.createNativeQuery(
                        "DELETE FROM brain_tags WHERE brain_id = :brainId AND tag_id = :tagId")
                .setParameter("brainId", brainId)
                .setParameter("tagId", tagId)
                .executeUpdate();
    }

    public List<TagResponse> getTagsForBrain(UUID brainId) {
        return getTagsForBrains(List.of(brainId)).getOrDefault(brainId, Collections.emptyList());
    }

    public Map<UUID, List<TagResponse>> getTagsForBrains(Collection<UUID> brainIds) {
        if (brainIds == null || brainIds.isEmpty()) return Collections.emptyMap();

        List<Object[]> rows = tagRepository.findTagsWithBrainIds(brainIds);
        Map<UUID, List<TagResponse>> result = new HashMap<>();
        for (Object[] row : rows) {
            UUID brainId = (UUID) row[0];
            TagResponse tag = new TagResponse(
                    (UUID) row[1],
                    (String) row[2],
                    (String) row[3],
                    ((Timestamp) row[4]).toLocalDateTime(),
                    ((Timestamp) row[5]).toLocalDateTime()
            );
            result.computeIfAbsent(brainId, k -> new ArrayList<>()).add(tag);
        }
        return result;
    }

    private TagResponse toResponse(Tag tag) {
        return new TagResponse(
                tag.getId(),
                tag.getName(),
                tag.getColor(),
                tag.getCreatedAt(),
                tag.getUpdatedAt()
        );
    }
}
