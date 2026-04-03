package com.wliant.brainbook.controller;

import com.wliant.brainbook.dto.LinkSuggestionResponse;
import com.wliant.brainbook.dto.NeuronLinkResponse;
import com.wliant.brainbook.service.LinkSuggestionService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/link-suggestions")
public class LinkSuggestionController {

    private final LinkSuggestionService linkSuggestionService;

    public LinkSuggestionController(LinkSuggestionService linkSuggestionService) {
        this.linkSuggestionService = linkSuggestionService;
    }

    @GetMapping("/neuron/{neuronId}")
    public List<LinkSuggestionResponse> getSuggestionsForNeuron(@PathVariable UUID neuronId) {
        return linkSuggestionService.getSuggestionsForNeuron(neuronId);
    }

    @PostMapping("/{id}/accept")
    public ResponseEntity<NeuronLinkResponse> acceptSuggestion(@PathVariable UUID id) {
        NeuronLinkResponse response = linkSuggestionService.acceptSuggestion(id);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }
}
