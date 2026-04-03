package com.wliant.brainbook.service;

import com.wliant.brainbook.dto.MoveNeuronRequest;
import com.wliant.brainbook.dto.NeuronAnchorResponse;
import com.wliant.brainbook.dto.NeuronContentRequest;
import com.wliant.brainbook.dto.NeuronRequest;
import com.wliant.brainbook.dto.NeuronResponse;
import com.wliant.brainbook.dto.NeuronSummary;
import com.wliant.brainbook.dto.ReorderRequest;
import com.wliant.brainbook.dto.TagResponse;
import com.wliant.brainbook.exception.ConflictException;
import com.wliant.brainbook.exception.ResourceNotFoundException;
import com.wliant.brainbook.model.Brain;
import com.wliant.brainbook.model.Cluster;
import com.wliant.brainbook.model.Neuron;
import com.wliant.brainbook.model.NeuronLink;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.wliant.brainbook.repository.BrainRepository;
import com.wliant.brainbook.repository.ClusterRepository;
import com.wliant.brainbook.repository.NeuronLinkRepository;
import com.wliant.brainbook.repository.NeuronRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@Transactional
public class NeuronService {

    private static final Logger logger = LoggerFactory.getLogger(NeuronService.class);

    private final NeuronRepository neuronRepository;
    private final BrainRepository brainRepository;
    private final ClusterRepository clusterRepository;
    private final NeuronLinkRepository neuronLinkRepository;
    private final TagService tagService;
    private final NeuronSnapshotSchedulerService snapshotScheduler;
    private final SettingsService settingsService;
    private final ReviewQuestionService reviewQuestionService;
    private final AnchorService anchorService;
    private final ObjectMapper objectMapper;

    public NeuronService(NeuronRepository neuronRepository,
                         BrainRepository brainRepository,
                         ClusterRepository clusterRepository,
                         NeuronLinkRepository neuronLinkRepository,
                         TagService tagService,
                         NeuronSnapshotSchedulerService snapshotScheduler,
                         SettingsService settingsService,
                         ReviewQuestionService reviewQuestionService,
                         AnchorService anchorService,
                         ObjectMapper objectMapper) {
        this.neuronRepository = neuronRepository;
        this.brainRepository = brainRepository;
        this.clusterRepository = clusterRepository;
        this.neuronLinkRepository = neuronLinkRepository;
        this.tagService = tagService;
        this.snapshotScheduler = snapshotScheduler;
        this.settingsService = settingsService;
        this.reviewQuestionService = reviewQuestionService;
        this.anchorService = anchorService;
        this.objectMapper = objectMapper;
    }

    public List<NeuronResponse> getByClusterId(UUID clusterId) {
        List<Neuron> neurons = neuronRepository.findByClusterIdAndIsDeletedFalseAndIsArchivedFalseOrderBySortOrderAsc(clusterId);
        return toResponseBatch(neurons);
    }

    public NeuronResponse getById(UUID id) {
        Neuron neuron = neuronRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Neuron not found: " + id));
        return toResponse(neuron);
    }

    @Transactional(readOnly = true)
    public List<NeuronResponse> getByIds(List<UUID> ids) {
        if (ids == null || ids.isEmpty()) return List.of();
        List<Neuron> neurons = neuronRepository.findAllById(ids);
        return toResponseBatch(neurons);
    }

    @Transactional(readOnly = true)
    public List<NeuronSummary> searchByTitle(String title, UUID brainId, int limit) {
        List<Neuron> neurons = neuronRepository.findByTitleContainingIgnoreCaseAndIsDeletedFalse(
                title, PageRequest.of(0, limit));
        return neurons.stream()
                .filter(n -> brainId == null || brainId.equals(n.getBrainId()))
                .map(n -> new NeuronSummary(n.getId(), n.getTitle(), n.getBrainId(), n.getClusterId()))
                .collect(Collectors.toList());
    }

    public List<NeuronResponse> getRecent(int limit) {
        Page<Neuron> page = neuronRepository.findByIsDeletedFalseAndIsArchivedFalseOrderByLastEditedAtDesc(
                PageRequest.of(0, limit));
        return toResponseBatch(page.getContent());
    }

    public List<NeuronResponse> getFavorites() {
        List<Neuron> neurons = neuronRepository.findByIsFavoriteTrueAndIsDeletedFalseOrderByUpdatedAtDesc();
        return toResponseBatch(neurons);
    }

    public List<NeuronResponse> getPinned() {
        List<Neuron> neurons = neuronRepository.findByIsPinnedTrueAndIsDeletedFalseOrderByUpdatedAtDesc();
        return toResponseBatch(neurons);
    }

    public NeuronResponse create(NeuronRequest req) {
        Brain brain = brainRepository.findById(req.brainId())
                .orElseThrow(() -> new ResourceNotFoundException("Brain not found: " + req.brainId()));
        Cluster cluster = clusterRepository.findById(req.clusterId())
                .orElseThrow(() -> new ResourceNotFoundException("Cluster not found: " + req.clusterId()));

        String user = settingsService.getDisplayName();
        Neuron neuron = new Neuron();
        neuron.setBrain(brain);
        neuron.setCluster(cluster);
        neuron.setTitle(req.title());
        neuron.setContentJson(req.contentJson());
        neuron.setContentText(req.contentText());
        neuron.setTemplateId(req.templateId());
        neuron.setSortOrder(0);
        neuron.setFavorite(false);
        neuron.setPinned(false);
        neuron.setArchived(false);
        neuron.setDeleted(false);
        neuron.setVersion(1);
        neuron.setCreatedBy(user);
        neuron.setLastUpdatedBy(user);

        Neuron saved = neuronRepository.save(neuron);

        // TODO: Anchor creation will be wired in Phase 2/3 when file content resolution is available

        return toResponse(saved);
    }

    public NeuronResponse update(UUID id, NeuronRequest req) {
        Neuron neuron = neuronRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Neuron not found: " + id));
        requireNotDeletedOrArchived(neuron);
        if (req.title() != null) neuron.setTitle(req.title());
        if (req.contentJson() != null) neuron.setContentJson(req.contentJson());
        if (req.contentText() != null) neuron.setContentText(req.contentText());
        if (req.templateId() != null) neuron.setTemplateId(req.templateId());
        if (req.complexity() != null) neuron.setComplexity(req.complexity());
        neuron.setLastEditedAt(LocalDateTime.now());
        neuron.setLastUpdatedBy(settingsService.getDisplayName());
        Neuron saved = neuronRepository.save(neuron);
        return toResponse(saved);
    }

    public NeuronResponse updateContent(UUID id, NeuronContentRequest req) {
        Neuron neuron = neuronRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Neuron not found: " + id));
        requireNotDeletedOrArchived(neuron);

        if (neuron.getVersion() != req.clientVersion()) {
            throw new ConflictException("Version conflict: expected " + req.clientVersion()
                    + " but found " + neuron.getVersion());
        }

        neuron.setContentJson(req.contentJson());
        neuron.setContentText(req.contentText());
        neuron.setVersion(neuron.getVersion() + 1);
        neuron.setLastEditedAt(LocalDateTime.now());
        neuron.setLastUpdatedBy(settingsService.getDisplayName());
        Neuron saved = neuronRepository.save(neuron);
        snapshotScheduler.recordUpdate(id);
        reviewQuestionService.markStaleByNeuron(id, reviewQuestionService.computeContentHash(req.contentText()));
        syncEditorLinks(id, req.contentJson());
        return toResponse(saved);
    }

    void syncEditorLinks(UUID sourceNeuronId, String contentJson) {
        if (contentJson == null || contentJson.isBlank()) return;

        Set<UUID> referencedIds = extractWikiLinkIds(contentJson);

        List<NeuronLink> existingEditorLinks = neuronLinkRepository.findBySourceNeuronIdAndSource(
                sourceNeuronId, "editor");

        Set<UUID> existingTargetIds = existingEditorLinks.stream()
                .map(NeuronLink::getTargetNeuronId)
                .collect(Collectors.toSet());

        // Determine new targets to link
        List<UUID> newTargetIds = referencedIds.stream()
                .filter(id -> !existingTargetIds.contains(id) && !id.equals(sourceNeuronId))
                .toList();

        if (!newTargetIds.isEmpty()) {
            Neuron source = neuronRepository.findById(sourceNeuronId).orElse(null);
            if (source == null) {
                logger.warn("syncEditorLinks: source neuron not found id={}", sourceNeuronId);
                return;
            }

            // Batch fetch all targets in one query, filtering out deleted/archived
            Map<UUID, Neuron> targetMap = neuronRepository.findAllById(newTargetIds).stream()
                    .filter(n -> !n.isDeleted() && !n.isArchived())
                    .collect(Collectors.toMap(Neuron::getId, n -> n));

            for (UUID targetId : newTargetIds) {
                Neuron target = targetMap.get(targetId);
                if (target == null) {
                    logger.debug("syncEditorLinks: target neuron not found or deleted id={}, skipping", targetId);
                    continue;
                }
                // Check for existing link (manual or editor) to avoid unique constraint violation
                if (neuronLinkRepository.findBySourceNeuronIdAndTargetNeuronId(sourceNeuronId, targetId).isEmpty()) {
                    NeuronLink link = new NeuronLink();
                    link.setSourceNeuron(source);
                    link.setTargetNeuron(target);
                    link.setLinkType("references");
                    link.setSource("editor");
                    neuronLinkRepository.save(link);
                }
            }

            logger.debug("syncEditorLinks: created {} new editor links from neuron {}",
                    newTargetIds.size(), sourceNeuronId);
        }

        // Delete editor links that are no longer referenced
        List<NeuronLink> toDelete = existingEditorLinks.stream()
                .filter(link -> !referencedIds.contains(link.getTargetNeuronId()))
                .toList();
        if (!toDelete.isEmpty()) {
            neuronLinkRepository.deleteAll(toDelete);
            logger.debug("syncEditorLinks: removed {} stale editor links from neuron {}",
                    toDelete.size(), sourceNeuronId);
        }
    }

    Set<UUID> extractWikiLinkIds(String contentJson) {
        Set<UUID> ids = new HashSet<>();
        try {
            JsonNode root = objectMapper.readTree(contentJson);
            extractWikiLinkIdsRecursive(root, ids);
        } catch (JsonProcessingException e) {
            logger.error("Failed to parse content JSON for wiki link extraction: {}",
                    contentJson.substring(0, Math.min(100, contentJson.length())), e);
        }
        return ids;
    }

    private void extractWikiLinkIdsRecursive(JsonNode node, Set<UUID> ids) {
        if (node == null) return;

        if (node.has("type") && "wikiLink".equals(node.get("type").asText())) {
            JsonNode attrs = node.get("attrs");
            if (attrs != null && attrs.has("neuronId")) {
                String neuronIdStr = attrs.get("neuronId").asText();
                try {
                    ids.add(UUID.fromString(neuronIdStr));
                } catch (IllegalArgumentException e) {
                    logger.warn("Invalid UUID in wiki link: {}", neuronIdStr);
                }
            }
        }

        if (node.has("content") && node.get("content").isArray()) {
            for (JsonNode child : node.get("content")) {
                extractWikiLinkIdsRecursive(child, ids);
            }
        }
        if (node.has("sections") && node.get("sections").isArray()) {
            for (JsonNode section : node.get("sections")) {
                if (section.has("content")) {
                    extractWikiLinkIdsRecursive(section.get("content"), ids);
                }
            }
        }
    }

    public void delete(UUID id) {
        Neuron neuron = neuronRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Neuron not found: " + id));
        neuron.setDeleted(true);
        neuron.setLastUpdatedBy(settingsService.getDisplayName());
        neuronRepository.save(neuron);
    }

    public NeuronResponse archive(UUID id) {
        Neuron neuron = neuronRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Neuron not found: " + id));
        if (neuron.isDeleted()) {
            throw new ConflictException("Cannot archive a deleted neuron");
        }
        neuron.setArchived(true);
        neuron.setLastUpdatedBy(settingsService.getDisplayName());
        Neuron saved = neuronRepository.save(neuron);
        return toResponse(saved);
    }

    public NeuronResponse restore(UUID id) {
        Neuron neuron = neuronRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Neuron not found: " + id));
        neuron.setArchived(false);
        neuron.setLastUpdatedBy(settingsService.getDisplayName());
        Neuron saved = neuronRepository.save(neuron);
        return toResponse(saved);
    }

    public NeuronResponse move(UUID id, MoveNeuronRequest req) {
        Neuron neuron = neuronRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Neuron not found: " + id));
        Brain brain = brainRepository.findById(req.targetBrainId())
                .orElseThrow(() -> new ResourceNotFoundException("Brain not found: " + req.targetBrainId()));
        Cluster cluster = clusterRepository.findById(req.targetClusterId())
                .orElseThrow(() -> new ResourceNotFoundException("Cluster not found: " + req.targetClusterId()));

        neuron.setBrain(brain);
        neuron.setCluster(cluster);
        neuron.setLastUpdatedBy(settingsService.getDisplayName());
        Neuron saved = neuronRepository.save(neuron);
        return toResponse(saved);
    }

    public NeuronResponse duplicate(UUID id) {
        Neuron original = neuronRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Neuron not found: " + id));
        requireNotDeletedOrArchived(original);

        String user = settingsService.getDisplayName();
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
        copy.setCreatedBy(user);
        copy.setLastUpdatedBy(user);

        Neuron saved = neuronRepository.save(copy);
        return toResponse(saved);
    }

    public NeuronResponse toggleFavorite(UUID id) {
        Neuron neuron = neuronRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Neuron not found: " + id));
        requireNotDeletedOrArchived(neuron);
        neuron.setFavorite(!neuron.isFavorite());
        neuron.setLastUpdatedBy(settingsService.getDisplayName());
        Neuron saved = neuronRepository.save(neuron);
        return toResponse(saved);
    }

    public NeuronResponse togglePin(UUID id) {
        Neuron neuron = neuronRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Neuron not found: " + id));
        requireNotDeletedOrArchived(neuron);
        neuron.setPinned(!neuron.isPinned());
        neuron.setLastUpdatedBy(settingsService.getDisplayName());
        Neuron saved = neuronRepository.save(neuron);
        return toResponse(saved);
    }

    public void reorder(ReorderRequest req) {
        ReorderHelper.reorder(req, neuronRepository, Neuron::setSortOrder, "Neuron");
    }

    public List<NeuronResponse> getTrash() {
        List<Neuron> neurons = neuronRepository.findByIsDeletedTrueOrderByUpdatedAtDesc();
        return toResponseBatch(neurons);
    }

    public NeuronResponse restoreFromTrash(UUID id) {
        Neuron neuron = neuronRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Neuron not found: " + id));
        neuron.setDeleted(false);
        neuron.setLastUpdatedBy(settingsService.getDisplayName());
        Neuron saved = neuronRepository.save(neuron);
        return toResponse(saved);
    }

    public void permanentDelete(UUID id) {
        Neuron neuron = neuronRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Neuron not found: " + id));
        neuronRepository.delete(neuron);
    }

    private void requireNotDeletedOrArchived(Neuron neuron) {
        if (neuron.isDeleted()) {
            throw new ConflictException("Cannot modify a deleted neuron");
        }
        if (neuron.isArchived()) {
            throw new ConflictException("Cannot modify an archived neuron");
        }
    }

    public NeuronResponse toResponse(Neuron neuron) {
        List<TagResponse> tags;
        try {
            tags = tagService.getTagsForNeuron(neuron.getId());
        } catch (Exception e) {
            logger.error("Failed to fetch tags for neuron id={}", neuron.getId(), e);
            tags = Collections.emptyList();
        }

        return toResponseWithTags(neuron, tags);
    }

    public List<NeuronResponse> toResponseBatch(List<Neuron> neurons) {
        if (neurons == null || neurons.isEmpty()) return List.of();

        List<UUID> neuronIds = neurons.stream().map(Neuron::getId).collect(Collectors.toList());
        Map<UUID, List<TagResponse>> tagsByNeuron;
        try {
            tagsByNeuron = tagService.getTagsForNeurons(neuronIds);
        } catch (Exception e) {
            logger.error("Failed to batch fetch tags for {} neurons", neuronIds.size(), e);
            tagsByNeuron = Collections.emptyMap();
        }

        Map<UUID, NeuronAnchorResponse> anchorsByNeuron;
        try {
            anchorsByNeuron = anchorService.getByNeuronIds(neuronIds);
        } catch (Exception e) {
            logger.debug("Failed to batch fetch anchors for {} neurons", neuronIds.size(), e);
            anchorsByNeuron = Collections.emptyMap();
        }

        Map<UUID, List<TagResponse>> finalTags = tagsByNeuron;
        Map<UUID, NeuronAnchorResponse> finalAnchors = anchorsByNeuron;
        return neurons.stream()
                .map(n -> buildResponse(n,
                        finalTags.getOrDefault(n.getId(), Collections.emptyList()),
                        finalAnchors.get(n.getId())))
                .collect(Collectors.toList());
    }

    private NeuronResponse toResponseWithTags(Neuron neuron, List<TagResponse> tags) {
        NeuronAnchorResponse anchor = null;
        try {
            anchor = anchorService.getByNeuronId(neuron.getId());
        } catch (Exception e) {
            logger.debug("Failed to fetch anchor for neuron id={}", neuron.getId(), e);
        }
        return buildResponse(neuron, tags, anchor);
    }

    private NeuronResponse buildResponse(Neuron neuron, List<TagResponse> tags, NeuronAnchorResponse anchor) {
        return new NeuronResponse(
                neuron.getId(),
                neuron.getBrain() != null ? neuron.getBrain().getId() : neuron.getBrainId(),
                neuron.getCluster() != null ? neuron.getCluster().getId() : neuron.getClusterId(),
                neuron.getTitle(),
                neuron.getContentJson(),
                neuron.getContentText(),
                neuron.getTemplateId(),
                neuron.getSortOrder(),
                neuron.isFavorite(),
                neuron.isPinned(),
                neuron.isArchived(),
                neuron.isDeleted(),
                neuron.getVersion(),
                neuron.getComplexity(),
                neuron.getLastEditedAt(),
                neuron.getCreatedAt(),
                neuron.getUpdatedAt(),
                neuron.getCreatedBy(),
                neuron.getLastUpdatedBy(),
                tags,
                anchor
        );
    }
}
