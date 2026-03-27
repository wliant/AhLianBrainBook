package com.ahlian.brainbook.service;

import com.ahlian.brainbook.dto.NeuronResponse;
import com.ahlian.brainbook.dto.SearchResponse;
import com.ahlian.brainbook.model.Neuron;
import com.ahlian.brainbook.repository.NeuronRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class SearchService {

    private final NeuronRepository neuronRepository;
    private final NeuronService neuronService;

    public SearchService(NeuronRepository neuronRepository, NeuronService neuronService) {
        this.neuronRepository = neuronRepository;
        this.neuronService = neuronService;
    }

    public SearchResponse search(String query, UUID brainId, UUID clusterId, int page, int size) {
        if (query == null || query.isBlank()) {
            return new SearchResponse(List.of(), 0);
        }

        Page<Neuron> results = neuronRepository.search(query, PageRequest.of(page, size));

        List<NeuronResponse> filtered = results.getContent().stream()
                .filter(n -> brainId == null || brainId.equals(n.getBrainId()))
                .filter(n -> clusterId == null || clusterId.equals(n.getClusterId()))
                .map(n -> neuronService.getById(n.getId()))
                .collect(Collectors.toList());

        return new SearchResponse(filtered, results.getTotalElements());
    }
}
