package com.wliant.brainbook.controller;

import com.wliant.brainbook.dto.NeuronAnchorResponse;
import com.wliant.brainbook.service.AnchorService;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
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

    @GetMapping("/cluster/{clusterId}/orphaned")
    public ResponseEntity<List<NeuronAnchorResponse>> listOrphaned(@PathVariable UUID clusterId) {
        return ResponseEntity.ok(anchorService.listOrphanedAndDrifted(clusterId));
    }

    @PostMapping
    public ResponseEntity<Map<String, String>> create() {
        return ResponseEntity.status(HttpStatus.NOT_IMPLEMENTED)
                .body(Map.of("error", "Anchor creation requires file content resolution. Will be enabled in Phase 2/3."));
    }

    @PatchMapping("/{id}")
    public ResponseEntity<Map<String, String>> update(@PathVariable UUID id) {
        return ResponseEntity.status(HttpStatus.NOT_IMPLEMENTED)
                .body(Map.of("error", "Re-anchoring requires file content resolution. Will be enabled in Phase 2/3."));
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
