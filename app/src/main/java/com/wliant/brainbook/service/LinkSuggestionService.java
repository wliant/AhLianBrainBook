package com.wliant.brainbook.service;

import com.wliant.brainbook.dto.LinkSuggestionResponse;
import com.wliant.brainbook.dto.NeuronLinkRequest;
import com.wliant.brainbook.dto.NeuronLinkResponse;
import com.wliant.brainbook.exception.ResourceNotFoundException;
import com.wliant.brainbook.model.LinkSuggestion;
import com.wliant.brainbook.model.Neuron;
import com.wliant.brainbook.repository.LinkSuggestionRepository;
import com.wliant.brainbook.repository.NeuronEmbeddingRepository;
import com.wliant.brainbook.repository.NeuronRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneOffset;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class LinkSuggestionService {

    private static final Logger logger = LoggerFactory.getLogger(LinkSuggestionService.class);

    private final LinkSuggestionRepository linkSuggestionRepository;
    private final NeuronEmbeddingRepository neuronEmbeddingRepository;
    private final NeuronRepository neuronRepository;
    private final NeuronLinkService neuronLinkService;

    public LinkSuggestionService(LinkSuggestionRepository linkSuggestionRepository,
                                  NeuronEmbeddingRepository neuronEmbeddingRepository,
                                  NeuronRepository neuronRepository,
                                  NeuronLinkService neuronLinkService) {
        this.linkSuggestionRepository = linkSuggestionRepository;
        this.neuronEmbeddingRepository = neuronEmbeddingRepository;
        this.neuronRepository = neuronRepository;
        this.neuronLinkService = neuronLinkService;
    }

    @Transactional(readOnly = true)
    public List<LinkSuggestionResponse> getSuggestionsForNeuron(UUID neuronId) {
        neuronRepository.findById(neuronId)
                .orElseThrow(() -> new ResourceNotFoundException("Neuron not found: " + neuronId));

        List<Object[]> rows = linkSuggestionRepository.findSuggestionsForNeuron(neuronId);
        return rows.stream().map(this::mapRow).toList();
    }

    @Transactional
    public NeuronLinkResponse acceptSuggestion(UUID suggestionId) {
        LinkSuggestion suggestion = linkSuggestionRepository.findById(suggestionId)
                .orElseThrow(() -> new ResourceNotFoundException("Suggestion not found: " + suggestionId));

        String linkType = switch (suggestion.getSuggestionType()) {
            case "references" -> "references";
            case "related" -> "related-to";
            default -> suggestion.getSuggestionType();
        };

        NeuronLinkRequest req = new NeuronLinkRequest(
                suggestion.getSourceNeuronId(),
                suggestion.getTargetNeuronId(),
                null,
                linkType,
                suggestion.getScore(),
                "suggestion"
        );

        return neuronLinkService.create(req);
    }

    @Transactional
    public void recomputeReferenceSuggestions(UUID neuronId, String contentJson) {
        List<LinkSuggestion> existing = linkSuggestionRepository
                .findBySourceNeuronIdAndSuggestionType(neuronId, "references");
        Map<UUID, LinkSuggestion> existingByTarget = existing.stream()
                .collect(Collectors.toMap(LinkSuggestion::getTargetNeuronId, s -> s));

        Set<UUID> newTargetIds;
        if (contentJson != null && !contentJson.isBlank()) {
            newTargetIds = WikiLinkExtractor.extractWikiLinkIds(contentJson);
            newTargetIds.remove(neuronId); // no self-references
        } else {
            newTargetIds = Set.of();
        }

        // Remove stale suggestions
        List<LinkSuggestion> toDelete = existing.stream()
                .filter(s -> !newTargetIds.contains(s.getTargetNeuronId()))
                .toList();
        if (!toDelete.isEmpty()) {
            linkSuggestionRepository.deleteAll(toDelete);
        }

        // Add new suggestions (targets not already in existing)
        Set<UUID> toAddIds = newTargetIds.stream()
                .filter(id -> !existingByTarget.containsKey(id))
                .collect(Collectors.toSet());

        if (!toAddIds.isEmpty()) {
            Neuron source = neuronRepository.findById(neuronId).orElse(null);
            if (source == null) return;

            Map<UUID, Neuron> targetMap = neuronRepository.findAllById(toAddIds).stream()
                    .filter(n -> !n.isDeleted() && !n.isArchived())
                    .collect(Collectors.toMap(Neuron::getId, n -> n));

            List<LinkSuggestion> toInsert = new ArrayList<>();
            for (UUID targetId : toAddIds) {
                Neuron target = targetMap.get(targetId);
                if (target == null) continue;

                LinkSuggestion s = new LinkSuggestion();
                s.setSourceNeuron(source);
                s.setTargetNeuron(target);
                s.setSuggestionType("references");
                s.setScore(1.0);
                toInsert.add(s);
            }
            if (!toInsert.isEmpty()) {
                linkSuggestionRepository.saveAll(toInsert);
            }
        }

        logger.info("Recomputed references for neuron {}: kept={}, added={}, removed={}",
                neuronId, existingByTarget.size() - toDelete.size(), toAddIds.size(), toDelete.size());
    }

    @Transactional
    public void recomputeRelatedSuggestions(UUID neuronId, String embeddingVector) {
        Neuron neuron = neuronRepository.findById(neuronId).orElse(null);
        if (neuron == null) return;

        List<Object[]> similarRows = neuronEmbeddingRepository.findMostSimilar(
                neuronId, embeddingVector, neuron.getBrainId(), 10);

        List<LinkSuggestion> existing = linkSuggestionRepository
                .findBySourceNeuronIdAndSuggestionType(neuronId, "related");
        Map<UUID, LinkSuggestion> existingByTarget = existing.stream()
                .collect(Collectors.toMap(LinkSuggestion::getTargetNeuronId, s -> s));

        Map<UUID, Double> newSimilarityMap = similarRows.stream()
                .collect(Collectors.toMap(
                        row -> (UUID) row[0],
                        row -> ((Number) row[1]).doubleValue()));
        Set<UUID> newTargetIds = newSimilarityMap.keySet();

        // Remove stale suggestions
        List<LinkSuggestion> toDelete = existing.stream()
                .filter(s -> !newTargetIds.contains(s.getTargetNeuronId()))
                .toList();
        if (!toDelete.isEmpty()) {
            linkSuggestionRepository.deleteAll(toDelete);
        }

        // Update scores for existing suggestions that changed
        for (LinkSuggestion s : existing) {
            Double newScore = newSimilarityMap.get(s.getTargetNeuronId());
            if (newScore != null && !newScore.equals(s.getScore())) {
                s.setScore(newScore);
                linkSuggestionRepository.save(s);
            }
        }

        // Add new suggestions
        Set<UUID> toAddIds = newTargetIds.stream()
                .filter(id -> !existingByTarget.containsKey(id))
                .collect(Collectors.toSet());

        if (!toAddIds.isEmpty()) {
            Map<UUID, Neuron> targetMap = neuronRepository.findAllById(toAddIds).stream()
                    .collect(Collectors.toMap(Neuron::getId, n -> n));

            List<LinkSuggestion> toInsert = new ArrayList<>();
            for (UUID targetId : toAddIds) {
                Neuron target = targetMap.get(targetId);
                if (target == null) continue;

                LinkSuggestion s = new LinkSuggestion();
                s.setSourceNeuron(neuron);
                s.setTargetNeuron(target);
                s.setSuggestionType("related");
                s.setScore(newSimilarityMap.get(targetId));
                toInsert.add(s);
            }
            if (!toInsert.isEmpty()) {
                linkSuggestionRepository.saveAll(toInsert);
            }
        }

        logger.info("Recomputed related for neuron {}: kept={}, added={}, removed={}",
                neuronId, existingByTarget.size() - toDelete.size(), toAddIds.size(), toDelete.size());
    }

    private LinkSuggestionResponse mapRow(Object[] row) {
        return new LinkSuggestionResponse(
                (UUID) row[0],                               // id
                (UUID) row[1],                               // sourceNeuronId
                (String) row[7],                             // sourceNeuronTitle
                (UUID) row[8],                               // sourceNeuronClusterId
                (UUID) row[2],                               // targetNeuronId
                (String) row[9],                             // targetNeuronTitle
                (UUID) row[10],                              // targetNeuronClusterId
                (String) row[3],                             // suggestionType
                (String) row[6],                             // displayType
                row[4] != null ? ((Number) row[4]).doubleValue() : null,  // score
                row[5] != null ? toLocalDateTime(row[5]) : null  // createdAt
        );
    }

    private static LocalDateTime toLocalDateTime(Object value) {
        if (value instanceof Instant instant) {
            return LocalDateTime.ofInstant(instant, ZoneOffset.UTC);
        }
        if (value instanceof java.sql.Timestamp ts) {
            return ts.toLocalDateTime();
        }
        throw new IllegalArgumentException("Unexpected timestamp type: " + value.getClass());
    }
}
