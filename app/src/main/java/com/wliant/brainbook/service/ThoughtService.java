package com.wliant.brainbook.service;

import com.wliant.brainbook.dto.NeuronResponse;
import com.wliant.brainbook.dto.TagResponse;
import com.wliant.brainbook.dto.ThoughtRequest;
import com.wliant.brainbook.dto.ThoughtResponse;
import com.wliant.brainbook.exception.ResourceNotFoundException;
import com.wliant.brainbook.model.Neuron;
import com.wliant.brainbook.model.Thought;
import com.wliant.brainbook.repository.TagRepository;
import com.wliant.brainbook.repository.ThoughtRepository;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Collections;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@Transactional
public class ThoughtService {

    private static final Logger log = LoggerFactory.getLogger(ThoughtService.class);

    private final ThoughtRepository thoughtRepository;
    private final TagRepository tagRepository;
    private final NeuronService neuronService;

    @PersistenceContext
    private EntityManager entityManager;

    public ThoughtService(ThoughtRepository thoughtRepository,
                          TagRepository tagRepository,
                          NeuronService neuronService) {
        this.thoughtRepository = thoughtRepository;
        this.tagRepository = tagRepository;
        this.neuronService = neuronService;
    }

    public List<ThoughtResponse> getAll() {
        return thoughtRepository.findAllByOrderBySortOrderAsc().stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    public ThoughtResponse getById(UUID id) {
        Thought thought = findOrThrow(id);
        return toResponse(thought);
    }

    public ThoughtResponse create(ThoughtRequest req) {
        Thought thought = new Thought();
        thought.setName(req.name());
        thought.setDescription(req.description());
        thought.setNeuronTagMode(req.neuronTagMode() != null ? req.neuronTagMode() : "any");
        thought.setBrainTagMode(req.brainTagMode() != null ? req.brainTagMode() : "any");
        thought.setSortOrder(0);
        Thought saved = thoughtRepository.save(thought);

        entityManager.flush();
        setTags(saved.getId(), req.neuronTagIds(), "thought_neuron_tags");
        if (req.brainTagIds() != null) {
            setTags(saved.getId(), req.brainTagIds(), "thought_brain_tags");
        }

        log.info("Created thought '{}' (id={})", saved.getName(), saved.getId());
        return toResponse(saved);
    }

    public ThoughtResponse update(UUID id, ThoughtRequest req) {
        Thought thought = findOrThrow(id);
        thought.setName(req.name());
        thought.setDescription(req.description());
        if (req.neuronTagMode() != null) {
            thought.setNeuronTagMode(req.neuronTagMode());
        }
        if (req.brainTagMode() != null) {
            thought.setBrainTagMode(req.brainTagMode());
        }
        Thought saved = thoughtRepository.save(thought);

        setTags(id, req.neuronTagIds(), "thought_neuron_tags");
        setTags(id, req.brainTagIds() != null ? req.brainTagIds() : Collections.emptyList(), "thought_brain_tags");

        log.info("Updated thought '{}' (id={})", saved.getName(), id);
        return toResponse(saved);
    }

    public void delete(UUID id) {
        Thought thought = findOrThrow(id);
        thoughtRepository.delete(thought);
        log.info("Deleted thought '{}' (id={})", thought.getName(), id);
    }

    @SuppressWarnings("unchecked")
    public List<NeuronResponse> resolveNeurons(UUID id) {
        Thought thought = findOrThrow(id);

        List<UUID> neuronTagIds = getTagIds(id, "thought_neuron_tags");
        List<UUID> brainTagIds = getTagIds(id, "thought_brain_tags");

        if (neuronTagIds.isEmpty()) {
            log.debug("Thought {} has no neuron tags, returning empty", id);
            return Collections.emptyList();
        }

        String sql = buildNeuronQuery(
                neuronTagIds, "any".equals(thought.getNeuronTagMode()),
                brainTagIds, "any".equals(thought.getBrainTagMode()));

        var query = entityManager.createNativeQuery(sql, Neuron.class);
        query.setParameter("neuronTagIds", neuronTagIds);
        if (!brainTagIds.isEmpty()) {
            query.setParameter("brainTagIds", brainTagIds);
        }

        List<Neuron> neurons = query.getResultList();
        log.debug("Resolved {} neurons for thought '{}' (id={}, neuronMode={}, brainMode={})",
                neurons.size(), thought.getName(), id,
                thought.getNeuronTagMode(), thought.getBrainTagMode());

        return neurons.stream()
                .map(neuronService::toResponse)
                .collect(Collectors.toList());
    }

    /**
     * Builds a single dynamic SQL query for neuron resolution based on tag match modes.
     * This replaces 6 separate repository query methods with one composable builder.
     */
    String buildNeuronQuery(List<UUID> neuronTagIds, boolean neuronAny,
                            List<UUID> brainTagIds, boolean brainAny) {
        boolean hasBrainTags = !brainTagIds.isEmpty();

        StringBuilder sql = new StringBuilder();
        sql.append("SELECT n.* FROM neurons n ");
        sql.append("JOIN neuron_tags nt ON nt.neuron_id = n.id ");
        sql.append("WHERE nt.tag_id IN (:neuronTagIds) ");
        sql.append("AND n.is_deleted = false ");
        sql.append("AND n.is_archived = false ");

        if (hasBrainTags) {
            sql.append("AND n.brain_id IN (");
            sql.append("  SELECT bt.brain_id FROM brain_tags bt ");
            sql.append("  WHERE bt.tag_id IN (:brainTagIds) ");
            if (!brainAny) {
                sql.append("  GROUP BY bt.brain_id ");
                sql.append("  HAVING COUNT(DISTINCT bt.tag_id) >= ").append(brainTagIds.size()).append(" ");
            }
            sql.append(") ");
        }

        sql.append("GROUP BY n.id ");
        if (!neuronAny) {
            sql.append("HAVING COUNT(DISTINCT nt.tag_id) >= ").append(neuronTagIds.size()).append(" ");
        }
        sql.append("ORDER BY n.last_edited_at DESC");

        return sql.toString();
    }

    private Thought findOrThrow(UUID id) {
        return thoughtRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Thought not found: " + id));
    }

    private void setTags(UUID thoughtId, List<UUID> tagIds, String tableName) {
        entityManager.createNativeQuery("DELETE FROM " + tableName + " WHERE thought_id = :thoughtId")
                .setParameter("thoughtId", thoughtId)
                .executeUpdate();

        if (tagIds != null) {
            for (UUID tagId : tagIds) {
                tagRepository.findById(tagId)
                        .orElseThrow(() -> new ResourceNotFoundException("Tag not found: " + tagId));
                entityManager.createNativeQuery(
                                "INSERT INTO " + tableName + " (thought_id, tag_id) VALUES (:thoughtId, :tagId)")
                        .setParameter("thoughtId", thoughtId)
                        .setParameter("tagId", tagId)
                        .executeUpdate();
            }
        }
    }

    @SuppressWarnings("unchecked")
    private List<UUID> getTagIds(UUID thoughtId, String tableName) {
        return entityManager.createNativeQuery(
                        "SELECT tag_id FROM " + tableName + " WHERE thought_id = :thoughtId")
                .setParameter("thoughtId", thoughtId)
                .getResultList();
    }

    private List<TagResponse> getTagResponses(UUID thoughtId, String tableName) {
        List<UUID> tagIds = getTagIds(thoughtId, tableName);
        return tagIds.stream()
                .map(tagId -> tagRepository.findById(tagId).orElse(null))
                .filter(t -> t != null)
                .map(t -> new TagResponse(t.getId(), t.getName(), t.getColor(), t.getCreatedAt(), t.getUpdatedAt()))
                .collect(Collectors.toList());
    }

    private ThoughtResponse toResponse(Thought thought) {
        return new ThoughtResponse(
                thought.getId(),
                thought.getName(),
                thought.getDescription(),
                thought.getNeuronTagMode(),
                thought.getBrainTagMode(),
                thought.getSortOrder(),
                thought.getCreatedAt(),
                thought.getUpdatedAt(),
                getTagResponses(thought.getId(), "thought_neuron_tags"),
                getTagResponses(thought.getId(), "thought_brain_tags")
        );
    }
}
