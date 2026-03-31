package com.wliant.brainbook.service;

import com.wliant.brainbook.dto.NeuronResponse;
import com.wliant.brainbook.dto.SearchResponse;
import com.wliant.brainbook.dto.SearchResultItem;
import com.wliant.brainbook.exception.ResourceNotFoundException;
import com.wliant.brainbook.repository.NeuronSearchRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@Transactional(readOnly = true)
public class SearchService {

    private static final Logger logger = LoggerFactory.getLogger(SearchService.class);

    private final NeuronSearchRepository neuronSearchRepository;
    private final NeuronService neuronService;

    public SearchService(NeuronSearchRepository neuronSearchRepository, NeuronService neuronService) {
        this.neuronSearchRepository = neuronSearchRepository;
        this.neuronService = neuronService;
    }

    public SearchResponse search(String query, UUID brainId, UUID clusterId,
                                 List<UUID> neuronTagIds, List<UUID> brainTagIds,
                                 int page, int size) {
        if (query == null || query.isBlank()) {
            return new SearchResponse(List.of(), 0);
        }

        NeuronSearchRepository.SearchResult result = neuronSearchRepository.search(
                query, brainId, clusterId, neuronTagIds, brainTagIds, page, size);

        if (result.rows().isEmpty()) {
            return new SearchResponse(List.of(), result.totalCount());
        }

        // Batch fetch all neurons to avoid N+1 queries
        List<UUID> ids = result.rows().stream()
                .map(NeuronSearchRepository.SearchRow::id)
                .toList();
        Map<UUID, NeuronResponse> neuronMap = neuronService.getByIds(ids).stream()
                .collect(Collectors.toMap(NeuronResponse::id, Function.identity()));

        List<SearchResultItem> items = result.rows().stream()
                .map(row -> {
                    NeuronResponse neuron = neuronMap.get(row.id());
                    if (neuron == null) {
                        logger.warn("Search result references missing neuron id={}", row.id());
                        return null;
                    }
                    return new SearchResultItem(neuron, row.highlight(), row.rank());
                })
                .filter(Objects::nonNull)
                .toList();

        return new SearchResponse(items, result.totalCount());
    }
}
