package com.wliant.brainbook.service;

import com.wliant.brainbook.dto.TagRequest;
import com.wliant.brainbook.dto.TagResponse;
import com.wliant.brainbook.exception.ResourceNotFoundException;
import com.wliant.brainbook.model.Tag;
import com.wliant.brainbook.repository.BrainRepository;
import com.wliant.brainbook.repository.NeuronRepository;
import com.wliant.brainbook.repository.TagRepository;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
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

    public TagResponse create(TagRequest req) {
        Tag tag = new Tag();
        tag.setName(req.name());
        tag.setColor(req.color());
        Tag saved = tagRepository.save(tag);
        return toResponse(saved);
    }

    public void delete(UUID id) {
        Tag tag = tagRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Tag not found: " + id));
        tagRepository.delete(tag);
    }

    public void addTagToNeuron(UUID neuronId, UUID tagId) {
        neuronRepository.findById(neuronId)
                .orElseThrow(() -> new ResourceNotFoundException("Neuron not found: " + neuronId));
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
        List<UUID> tagIds = entityManager.createNativeQuery(
                        "SELECT tag_id FROM neuron_tags WHERE neuron_id = :neuronId")
                .setParameter("neuronId", neuronId)
                .getResultList();

        return tagIds.stream()
                .map(tagId -> tagRepository.findById(tagId)
                        .map(this::toResponse)
                        .orElse(null))
                .filter(t -> t != null)
                .collect(Collectors.toList());
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

    @SuppressWarnings("unchecked")
    public List<TagResponse> getTagsForBrain(UUID brainId) {
        List<UUID> tagIds = entityManager.createNativeQuery(
                        "SELECT tag_id FROM brain_tags WHERE brain_id = :brainId")
                .setParameter("brainId", brainId)
                .getResultList();

        return tagIds.stream()
                .map(tagId -> tagRepository.findById(tagId)
                        .map(this::toResponse)
                        .orElse(null))
                .filter(t -> t != null)
                .collect(Collectors.toList());
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
