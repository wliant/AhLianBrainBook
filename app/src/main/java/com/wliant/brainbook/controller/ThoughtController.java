package com.wliant.brainbook.controller;

import com.wliant.brainbook.dto.NeuronResponse;
import com.wliant.brainbook.dto.ThoughtRequest;
import com.wliant.brainbook.dto.ThoughtResponse;
import com.wliant.brainbook.service.ThoughtService;
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
import java.util.UUID;

@RestController
@RequestMapping("/api/thoughts")
public class ThoughtController {

    private final ThoughtService thoughtService;

    public ThoughtController(ThoughtService thoughtService) {
        this.thoughtService = thoughtService;
    }

    @GetMapping
    public ResponseEntity<List<ThoughtResponse>> listThoughts() {
        return ResponseEntity.ok(thoughtService.getAll());
    }

    @PostMapping
    public ResponseEntity<ThoughtResponse> createThought(@Valid @RequestBody ThoughtRequest req) {
        return ResponseEntity.status(HttpStatus.CREATED).body(thoughtService.create(req));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ThoughtResponse> getThought(@PathVariable UUID id) {
        return ResponseEntity.ok(thoughtService.getById(id));
    }

    @PatchMapping("/{id}")
    public ResponseEntity<ThoughtResponse> updateThought(@PathVariable UUID id,
                                                          @Valid @RequestBody ThoughtRequest req) {
        return ResponseEntity.ok(thoughtService.update(id, req));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteThought(@PathVariable UUID id) {
        thoughtService.delete(id);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/{id}/neurons")
    public ResponseEntity<List<NeuronResponse>> getThoughtNeurons(@PathVariable UUID id) {
        return ResponseEntity.ok(thoughtService.resolveNeurons(id));
    }
}
