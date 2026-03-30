package com.wliant.brainbook.controller;

import com.wliant.brainbook.dto.NeuronLinkRequest;
import com.wliant.brainbook.dto.NeuronLinkResponse;
import com.wliant.brainbook.service.NeuronLinkService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/neuron-links")
public class NeuronLinkController {

    private final NeuronLinkService neuronLinkService;

    public NeuronLinkController(NeuronLinkService neuronLinkService) {
        this.neuronLinkService = neuronLinkService;
    }

    @GetMapping("/neuron/{neuronId}")
    public List<NeuronLinkResponse> getLinksForNeuron(@PathVariable UUID neuronId) {
        return neuronLinkService.getLinksForNeuron(neuronId);
    }

    @GetMapping("/brain/{brainId}")
    public List<NeuronLinkResponse> getLinksForBrain(@PathVariable UUID brainId) {
        return neuronLinkService.getLinksForBrain(brainId);
    }

    @PostMapping
    public ResponseEntity<NeuronLinkResponse> createLink(@Valid @RequestBody NeuronLinkRequest request) {
        NeuronLinkResponse response = neuronLinkService.create(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteLink(@PathVariable UUID id) {
        neuronLinkService.delete(id);
        return ResponseEntity.noContent().build();
    }
}
