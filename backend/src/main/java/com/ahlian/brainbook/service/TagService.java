package com.ahlian.brainbook.service;

import com.ahlian.brainbook.dto.TagRequest;
import com.ahlian.brainbook.dto.TagResponse;
import com.ahlian.brainbook.exception.ResourceNotFoundException;
import com.ahlian.brainbook.model.Neuron;
import com.ahlian.brainbook.model.Tag;
import com.ahlian.brainbook.repository.NeuronRepository;
import com.ahlian.brainbook.repository.TagRepository;
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

    @PersistenceContext
    private EntityManager entityManager;

    public TagService(TagRepository tagRepository, NeuronRepository neuronRepository) {
        this.tagRepository = tagRepository;
        this.neuronRepository = neuronRepository;
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
        tag.setName(req.getName());
        tag.setColor(req.getColor());
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

    private TagResponse toResponse(Tag tag) {
        TagResponse resp = new TagResponse();
        resp.setId(tag.getId());
        resp.setName(tag.getName());
        resp.setColor(tag.getColor());
        resp.setCreatedAt(tag.getCreatedAt());
        return resp;
    }
}
