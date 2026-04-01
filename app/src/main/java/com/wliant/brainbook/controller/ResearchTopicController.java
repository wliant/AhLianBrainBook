package com.wliant.brainbook.controller;

import com.wliant.brainbook.dto.CreateResearchTopicRequest;
import com.wliant.brainbook.dto.ExpandBulletRequest;
import com.wliant.brainbook.dto.ReorderRequest;
import com.wliant.brainbook.dto.ResearchTopicResponse;
import com.wliant.brainbook.service.ResearchTopicService;
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
@RequestMapping("/api/clusters/{clusterId}/research-topics")
public class ResearchTopicController {

    private final ResearchTopicService researchTopicService;

    public ResearchTopicController(ResearchTopicService researchTopicService) {
        this.researchTopicService = researchTopicService;
    }

    @GetMapping
    public ResponseEntity<List<ResearchTopicResponse>> list(@PathVariable UUID clusterId) {
        return ResponseEntity.ok(researchTopicService.list(clusterId));
    }

    @PostMapping
    public ResponseEntity<ResearchTopicResponse> create(@PathVariable UUID clusterId,
                                                         @Valid @RequestBody CreateResearchTopicRequest req) {
        return ResponseEntity.status(HttpStatus.CREATED).body(researchTopicService.create(clusterId, req));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ResearchTopicResponse> getById(@PathVariable UUID clusterId,
                                                          @PathVariable UUID id) {
        return ResponseEntity.ok(researchTopicService.getById(id));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable UUID clusterId, @PathVariable UUID id) {
        researchTopicService.delete(id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/reorder")
    public ResponseEntity<Void> reorder(@PathVariable UUID clusterId,
                                         @Valid @RequestBody ReorderRequest req) {
        researchTopicService.reorder(req);
        return ResponseEntity.ok().build();
    }

    @PostMapping("/refresh")
    public ResponseEntity<List<ResearchTopicResponse>> refreshAll(@PathVariable UUID clusterId) {
        return ResponseEntity.ok(researchTopicService.refreshAll(clusterId));
    }

    @PostMapping("/{id}/refresh")
    public ResponseEntity<ResearchTopicResponse> refresh(@PathVariable UUID clusterId,
                                                          @PathVariable UUID id) {
        return ResponseEntity.ok(researchTopicService.refresh(id));
    }

    @PostMapping("/{id}/expand")
    public ResponseEntity<ResearchTopicResponse> expand(@PathVariable UUID clusterId,
                                                         @PathVariable UUID id,
                                                         @Valid @RequestBody ExpandBulletRequest req) {
        return ResponseEntity.ok(researchTopicService.expandBullet(id, req.bulletId()));
    }
}
