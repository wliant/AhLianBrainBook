package com.wliant.brainbook.service;

import com.wliant.brainbook.dto.SearchResponse;
import com.wliant.brainbook.dto.SearchResultItem;
import com.wliant.brainbook.repository.NeuronSearchRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
@Transactional(readOnly = true)
public class SearchService {

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

        List<SearchResultItem> items = result.rows().stream()
                .map(row -> new SearchResultItem(
                        neuronService.getById(row.id()),
                        row.highlight(),
                        row.rank()))
                .toList();

        return new SearchResponse(items, result.totalCount());
    }
}
