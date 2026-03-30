package com.wliant.brainbook.service;

import com.wliant.brainbook.dto.BrainExportDto;
import com.wliant.brainbook.dto.BrainImportDto;
import com.wliant.brainbook.dto.BrainResponse;
import com.wliant.brainbook.exception.ResourceNotFoundException;
import com.wliant.brainbook.model.Brain;
import com.wliant.brainbook.model.Cluster;
import com.wliant.brainbook.model.Neuron;
import com.wliant.brainbook.model.NeuronLink;
import com.wliant.brainbook.model.Tag;
import com.wliant.brainbook.repository.BrainRepository;
import com.wliant.brainbook.repository.ClusterRepository;
import com.wliant.brainbook.repository.NeuronLinkRepository;
import com.wliant.brainbook.repository.NeuronRepository;
import com.wliant.brainbook.repository.TagRepository;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@Transactional
public class ImportExportService {

    private final BrainRepository brainRepository;
    private final ClusterRepository clusterRepository;
    private final NeuronRepository neuronRepository;
    private final TagRepository tagRepository;
    private final NeuronLinkRepository neuronLinkRepository;
    private final TagService tagService;

    @PersistenceContext
    private EntityManager entityManager;

    public ImportExportService(BrainRepository brainRepository,
                               ClusterRepository clusterRepository,
                               NeuronRepository neuronRepository,
                               TagRepository tagRepository,
                               NeuronLinkRepository neuronLinkRepository,
                               TagService tagService) {
        this.brainRepository = brainRepository;
        this.clusterRepository = clusterRepository;
        this.neuronRepository = neuronRepository;
        this.tagRepository = tagRepository;
        this.neuronLinkRepository = neuronLinkRepository;
        this.tagService = tagService;
    }

    // -----------------------------------------------------------------------
    // Export
    // -----------------------------------------------------------------------

    public BrainExportDto exportBrain(UUID brainId) {
        Brain brain = brainRepository.findById(brainId)
                .orElseThrow(() -> new ResourceNotFoundException("Brain not found: " + brainId));

        List<Cluster> clusters = clusterRepository.findByBrainIdOrderBySortOrder(brainId);
        List<Neuron> neurons = neuronRepository.findByBrainIdAndIsDeletedFalseAndIsArchivedFalseOrderByLastEditedAtDesc(brainId);
        List<NeuronLink> links = neuronLinkRepository.findAllByBrainId(brainId);

        // Collect all tag names used by neurons in this brain
        Map<UUID, List<String>> neuronTagMap = new HashMap<>();
        for (Neuron n : neurons) {
            List<String> tagNames = tagService.getTagsForNeuron(n.getId())
                    .stream().map(t -> t.name()).collect(Collectors.toList());
            neuronTagMap.put(n.getId(), tagNames);
        }

        // Unique tags
        List<BrainExportDto.TagData> tagDatas = neuronTagMap.values().stream()
                .flatMap(List::stream).distinct()
                .map(name -> new BrainExportDto.TagData(name, null))
                .collect(Collectors.toList());

        List<BrainExportDto.ClusterData> clusterDatas = clusters.stream()
                .map(c -> new BrainExportDto.ClusterData(
                        c.getId(), c.getName(), c.getParentClusterId(),
                        c.getSortOrder(), List.of()))
                .collect(Collectors.toList());

        List<BrainExportDto.NeuronData> neuronDatas = neurons.stream()
                .map(n -> new BrainExportDto.NeuronData(
                        n.getId(), n.getClusterId(), n.getTitle(),
                        n.getContentJson(), n.getContentText(),
                        n.getSortOrder(), n.isFavorite(), n.isPinned(),
                        neuronTagMap.getOrDefault(n.getId(), List.of()),
                        n.getCreatedAt()))
                .collect(Collectors.toList());

        List<BrainExportDto.LinkData> linkDatas = links.stream()
                .map(l -> new BrainExportDto.LinkData(
                        l.getSourceNeuronId(), l.getTargetNeuronId(),
                        l.getLabel(), l.getLinkType(), l.getWeight()))
                .collect(Collectors.toList());

        return new BrainExportDto(
                "1.0",
                new BrainExportDto.BrainData(
                        brain.getId(), brain.getName(), brain.getIcon(),
                        brain.getColor(), brain.getDescription(), brain.getCreatedAt()),
                clusterDatas,
                neuronDatas,
                tagDatas,
                linkDatas
        );
    }

    // -----------------------------------------------------------------------
    // Import
    // -----------------------------------------------------------------------

    public BrainResponse importBrain(BrainImportDto dto) {
        // 1. Create brain
        Brain brain = new Brain();
        brain.setName(dto.name());
        brain.setDescription(dto.description());
        brain.setSortOrder(0);
        brain.setArchived(false);
        brain = brainRepository.save(brain);
        UUID brainId = brain.getId();

        // 2. Create tags (deduplicated)
        Map<String, UUID> tagNameToId = new HashMap<>();
        if (dto.tags() != null) {
            for (BrainImportDto.ImportTag importTag : dto.tags()) {
                UUID tagId = findOrCreateTag(importTag.name(), importTag.color());
                tagNameToId.put(importTag.name(), tagId);
            }
        }

        // 3. Create clusters (two passes: first without parent, then set parents)
        Map<String, UUID> tempIdToClusterId = new HashMap<>();
        Map<String, String> clusterParentMap = new HashMap<>(); // tempId -> parentTempId

        if (dto.clusters() != null) {
            // First pass: create all clusters without parents
            for (BrainImportDto.ImportCluster ic : dto.clusters()) {
                Cluster cluster = new Cluster();
                cluster.setBrain(brainRepository.getReferenceById(brainId));
                cluster.setName(ic.name());
                cluster.setSortOrder(ic.sortOrder());
                cluster.setArchived(false);
                cluster = clusterRepository.save(cluster);
                if (ic.tempId() != null) {
                    tempIdToClusterId.put(ic.tempId(), cluster.getId());
                }
                if (ic.parentTempId() != null) {
                    clusterParentMap.put(ic.tempId(), ic.parentTempId());
                }
            }

            // Second pass: set parent cluster IDs
            for (Map.Entry<String, String> entry : clusterParentMap.entrySet()) {
                UUID clusterId = tempIdToClusterId.get(entry.getKey());
                UUID parentId = tempIdToClusterId.get(entry.getValue());
                if (clusterId != null && parentId != null) {
                    Cluster cluster = clusterRepository.getReferenceById(clusterId);
                    cluster.setParentClusterId(parentId);
                    clusterRepository.save(cluster);
                }
            }

            // 4. Create neurons within each cluster
            Map<String, UUID> tempIdToNeuronId = new HashMap<>();

            for (BrainImportDto.ImportCluster ic : dto.clusters()) {
                UUID clusterId = tempIdToClusterId.get(ic.tempId());
                if (clusterId == null || ic.neurons() == null) continue;

                for (BrainImportDto.ImportNeuron in : ic.neurons()) {
                    Neuron neuron = new Neuron();
                    neuron.setBrain(brainRepository.getReferenceById(brainId));
                    neuron.setCluster(clusterRepository.getReferenceById(clusterId));
                    neuron.setTitle(in.title());
                    neuron.setContentJson(in.contentJson());
                    neuron.setContentText(in.contentText());
                    neuron.setSortOrder(in.sortOrder());
                    neuron.setVersion(1);
                    neuron.setDeleted(false);
                    neuron.setArchived(false);
                    neuron.setFavorite(false);
                    neuron.setPinned(false);
                    neuron = neuronRepository.save(neuron);

                    if (in.tempId() != null) {
                        tempIdToNeuronId.put(in.tempId(), neuron.getId());
                    }

                    // Ensure tags exist and associate
                    if (in.tagNames() != null) {
                        for (String tagName : in.tagNames()) {
                            UUID tagId = tagNameToId.computeIfAbsent(tagName,
                                    name -> findOrCreateTag(name, null));
                            associateTag(neuron.getId(), tagId);
                        }
                    }
                }
            }

            // 5. Create links
            if (dto.links() != null) {
                for (BrainImportDto.ImportLink il : dto.links()) {
                    UUID sourceId = tempIdToNeuronId.get(il.sourceTempId());
                    UUID targetId = tempIdToNeuronId.get(il.targetTempId());
                    if (sourceId != null && targetId != null && !sourceId.equals(targetId)) {
                        NeuronLink link = new NeuronLink();
                        link.setSourceNeuron(neuronRepository.getReferenceById(sourceId));
                        link.setTargetNeuron(neuronRepository.getReferenceById(targetId));
                        link.setLabel(il.label());
                        link.setLinkType(il.linkType());
                        link.setWeight(il.weight() != null ? il.weight() : 1.0);
                        neuronLinkRepository.save(link);
                    }
                }
            }
        }

        // Build response
        List<com.wliant.brainbook.dto.TagResponse> brainTags = tagService.getTagsForBrain(brainId);
        return new BrainResponse(
                brain.getId(), brain.getName(), brain.getIcon(), brain.getColor(),
                brain.getDescription(), brain.getSortOrder(), brain.isArchived(),
                brain.getCreatedAt(), brain.getUpdatedAt(), brainTags);
    }

    private UUID findOrCreateTag(String name, String color) {
        List<Tag> existing = tagRepository.findByNameContainingIgnoreCase(name);
        for (Tag t : existing) {
            if (t.getName().equalsIgnoreCase(name)) {
                return t.getId();
            }
        }
        Tag tag = new Tag();
        tag.setName(name);
        tag.setColor(color);
        tag = tagRepository.save(tag);
        return tag.getId();
    }

    private void associateTag(UUID neuronId, UUID tagId) {
        entityManager.createNativeQuery(
                "INSERT INTO neuron_tags (neuron_id, tag_id) VALUES (:neuronId, :tagId) ON CONFLICT DO NOTHING")
                .setParameter("neuronId", neuronId)
                .setParameter("tagId", tagId)
                .executeUpdate();
    }
}
