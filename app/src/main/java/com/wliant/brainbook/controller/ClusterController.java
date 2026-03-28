package com.wliant.brainbook.controller;

import com.wliant.brainbook.dto.ClusterRequest;
import com.wliant.brainbook.dto.ClusterResponse;
import com.wliant.brainbook.dto.ReorderRequest;
import com.wliant.brainbook.service.ClusterService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/clusters")
public class ClusterController {

    private final ClusterService clusterService;

    public ClusterController(ClusterService clusterService) {
        this.clusterService = clusterService;
    }

    @GetMapping("/brain/{brainId}")
    public ResponseEntity<List<ClusterResponse>> listClusters(@PathVariable UUID brainId) {
        return ResponseEntity.ok(clusterService.getByBrainId(brainId));
    }

    @PostMapping
    public ResponseEntity<ClusterResponse> createCluster(@Valid @RequestBody ClusterRequest req) {
        return ResponseEntity.status(HttpStatus.CREATED).body(clusterService.create(req));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ClusterResponse> getCluster(@PathVariable UUID id) {
        return ResponseEntity.ok(clusterService.getById(id));
    }

    @PatchMapping("/{id}")
    public ResponseEntity<ClusterResponse> updateCluster(@PathVariable UUID id,
                                                         @Valid @RequestBody ClusterRequest req) {
        return ResponseEntity.ok(clusterService.update(id, req));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteCluster(@PathVariable UUID id) {
        clusterService.delete(id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{id}/archive")
    public ResponseEntity<ClusterResponse> archiveCluster(@PathVariable UUID id) {
        return ResponseEntity.ok(clusterService.archive(id));
    }

    @PostMapping("/{id}/restore")
    public ResponseEntity<ClusterResponse> restoreCluster(@PathVariable UUID id) {
        return ResponseEntity.ok(clusterService.restore(id));
    }

    @PostMapping("/reorder")
    public ResponseEntity<Void> reorderClusters(@Valid @RequestBody ReorderRequest req) {
        clusterService.reorder(req);
        return ResponseEntity.ok().build();
    }

    @PostMapping("/{id}/move")
    public ResponseEntity<ClusterResponse> moveCluster(@PathVariable UUID id,
                                                       @RequestBody Map<String, UUID> body) {
        UUID brainId = body.get("brainId");
        return ResponseEntity.ok(clusterService.move(id, brainId));
    }
}
