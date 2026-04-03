package com.wliant.brainbook.controller;

import com.wliant.brainbook.dto.CreateNeuronAnchorRequest;
import com.wliant.brainbook.dto.FileContentResponse;
import com.wliant.brainbook.dto.NeuronAnchorResponse;
import com.wliant.brainbook.dto.UpdateNeuronAnchorRequest;
import com.wliant.brainbook.service.AnchorService;
import com.wliant.brainbook.service.UrlBrowseService;
import jakarta.validation.Valid;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/neuron-anchors")
public class NeuronAnchorController {

    private final AnchorService anchorService;
    private final UrlBrowseService urlBrowseService;

    public NeuronAnchorController(AnchorService anchorService, UrlBrowseService urlBrowseService) {
        this.anchorService = anchorService;
        this.urlBrowseService = urlBrowseService;
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

    @GetMapping("/cluster/{clusterId}/orphaned")
    public ResponseEntity<List<NeuronAnchorResponse>> listOrphaned(@PathVariable UUID clusterId) {
        return ResponseEntity.ok(anchorService.listOrphanedAndDrifted(clusterId));
    }

    @PostMapping
    public ResponseEntity<NeuronAnchorResponse> create(
            @Valid @RequestBody CreateNeuronAnchorRequest req) {
        FileContentResponse file = urlBrowseService.getFile(req.clusterId(), null, req.filePath());
        NeuronAnchorResponse response = anchorService.create(req, file.content());
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @PatchMapping("/{id}")
    public ResponseEntity<NeuronAnchorResponse> update(
            @PathVariable UUID id,
            @Valid @RequestBody UpdateNeuronAnchorRequest req) {
        NeuronAnchorResponse existing = anchorService.getById(id);
        FileContentResponse file = urlBrowseService.getFile(existing.clusterId(), null, req.filePath());
        NeuronAnchorResponse response = anchorService.update(id, req, file.content());
        return ResponseEntity.ok(response);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable UUID id) {
        anchorService.delete(id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{id}/confirm-drift")
    public ResponseEntity<NeuronAnchorResponse> confirmDrift(@PathVariable UUID id) {
        return ResponseEntity.ok(anchorService.confirmDrift(id));
    }
}
