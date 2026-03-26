package com.ahlian.brainbook.controller;

import com.ahlian.brainbook.dto.NeuronResponse;
import com.ahlian.brainbook.dto.RevisionResponse;
import com.ahlian.brainbook.service.RevisionService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api")
public class RevisionController {

    private final RevisionService revisionService;

    public RevisionController(RevisionService revisionService) {
        this.revisionService = revisionService;
    }

    @GetMapping("/neurons/{neuronId}/revisions")
    public ResponseEntity<List<RevisionResponse>> getRevisions(@PathVariable UUID neuronId) {
        return ResponseEntity.ok(revisionService.getRevisions(neuronId));
    }

    @GetMapping("/revisions/{revisionId}")
    public ResponseEntity<RevisionResponse> getRevision(@PathVariable UUID revisionId) {
        return ResponseEntity.ok(revisionService.getRevision(revisionId));
    }

    @PostMapping("/revisions/{revisionId}/restore")
    public ResponseEntity<NeuronResponse> restoreRevision(@PathVariable UUID revisionId) {
        return ResponseEntity.ok(revisionService.restoreRevision(revisionId));
    }
}
