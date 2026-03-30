package com.wliant.brainbook.service;

import com.wliant.brainbook.dto.NeuronResponse;
import com.wliant.brainbook.dto.SearchResponse;
import com.wliant.brainbook.dto.TagResponse;
import com.wliant.brainbook.model.Neuron;
import com.wliant.brainbook.repository.NeuronRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class SearchService {

    private final NeuronRepository neuronRepository;
    private final NeuronService neuronService;
    private final TagService tagService;

    public SearchService(NeuronRepository neuronRepository, NeuronService neuronService, TagService tagService) {
        this.neuronRepository = neuronRepository;
        this.neuronService = neuronService;
        this.tagService = tagService;
    }

    public SearchResponse search(String query, UUID brainId, UUID clusterId,
                                 List<UUID> neuronTagIds, List<UUID> brainTagIds,
                                 int page, int size) {
        if (query == null || query.isBlank()) {
            return new SearchResponse(List.of(), 0);
        }

        Page<Neuron> results = neuronRepository.search(query, PageRequest.of(page, size));

        List<NeuronResponse> filtered = results.getContent().stream()
                .filter(n -> brainId == null || brainId.equals(n.getBrainId()))
                .filter(n -> clusterId == null || clusterId.equals(n.getClusterId()))
                .map(n -> neuronService.getById(n.getId()))
                .filter(n -> matchesNeuronTags(n, neuronTagIds))
                .filter(n -> matchesBrainTags(n.brainId(), brainTagIds))
                .collect(Collectors.toList());

        return new SearchResponse(filtered, results.getTotalElements());
    }

    private boolean matchesNeuronTags(NeuronResponse neuron, List<UUID> neuronTagIds) {
        if (neuronTagIds == null || neuronTagIds.isEmpty()) return true;
        Set<UUID> neuronTags = neuron.tags().stream()
                .map(TagResponse::id)
                .collect(Collectors.toSet());
        return neuronTags.containsAll(neuronTagIds);
    }

    private boolean matchesBrainTags(UUID brainId, List<UUID> brainTagIds) {
        if (brainTagIds == null || brainTagIds.isEmpty()) return true;
        Set<UUID> tags = tagService.getTagsForBrain(brainId).stream()
                .map(TagResponse::id)
                .collect(Collectors.toSet());
        return tags.containsAll(brainTagIds);
    }
}
