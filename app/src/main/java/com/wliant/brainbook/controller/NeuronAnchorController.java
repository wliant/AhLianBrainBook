package com.wliant.brainbook.controller;

import com.wliant.brainbook.dto.CreateNeuronAnchorRequest;
import com.wliant.brainbook.dto.NeuronAnchorResponse;
import com.wliant.brainbook.dto.UpdateNeuronAnchorRequest;
import com.wliant.brainbook.service.AnchorService;
import jakarta.validation.Valid;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/neuron-anchors")
public class NeuronAnchorController {

    private final AnchorService anchorService;

    public NeuronAnchorController(AnchorService anchorService) {
        this.anchorService = anchorService;
    }

    @GetMapping("/cluster/{clusterId}")
    public ResponseEntity<Page<NeuronAnchorResponse>> listByCluster(
            @PathVariable UUID clusterId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size) {
        return ResponseEntity.ok(anchorService.listByCluster(clusterId, PageRequest.of(page, size)));
    }

    @GetMapping("/cluster/{clusterId}/file")
    public ResponseEntity<Page<NeuronAnchorResponse>> listByFile(
            @PathVariable UUID clusterId,
            @RequestParam String path,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size) {
        return ResponseEntity.ok(anchorService.listByFile(clusterId, path, PageRequest.of(page, size)));
    }

    @PostMapping
    public ResponseEntity<NeuronAnchorResponse> create(
            @Valid @RequestBody CreateNeuronAnchorRequest req) {
        NeuronAnchorResponse response = anchorService.create(req);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @PatchMapping("/{id}")
    public ResponseEntity<NeuronAnchorResponse> update(
            @PathVariable UUID id,
            @Valid @RequestBody UpdateNeuronAnchorRequest req) {
        NeuronAnchorResponse response = anchorService.update(id, req);
        return ResponseEntity.ok(response);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable UUID id) {
        anchorService.delete(id);
        return ResponseEntity.noContent().build();
    }
}
