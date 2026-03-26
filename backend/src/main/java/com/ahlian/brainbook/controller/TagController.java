package com.ahlian.brainbook.controller;

import com.ahlian.brainbook.dto.TagRequest;
import com.ahlian.brainbook.dto.TagResponse;
import com.ahlian.brainbook.service.TagService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/tags")
public class TagController {

    private final TagService tagService;

    public TagController(TagService tagService) {
        this.tagService = tagService;
    }

    @GetMapping
    public ResponseEntity<List<TagResponse>> listTags() {
        return ResponseEntity.ok(tagService.getAll());
    }

    @GetMapping("/search")
    public ResponseEntity<List<TagResponse>> searchTags(@RequestParam("q") String query) {
        return ResponseEntity.ok(tagService.search(query));
    }

    @PostMapping
    public ResponseEntity<TagResponse> createTag(@Valid @RequestBody TagRequest req) {
        return ResponseEntity.status(HttpStatus.CREATED).body(tagService.create(req));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteTag(@PathVariable UUID id) {
        tagService.delete(id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/neurons/{neuronId}/tags/{tagId}")
    public ResponseEntity<Void> addTagToNeuron(@PathVariable UUID neuronId,
                                               @PathVariable UUID tagId) {
        tagService.addTagToNeuron(neuronId, tagId);
        return ResponseEntity.ok().build();
    }

    @DeleteMapping("/neurons/{neuronId}/tags/{tagId}")
    public ResponseEntity<Void> removeTagFromNeuron(@PathVariable UUID neuronId,
                                                    @PathVariable UUID tagId) {
        tagService.removeTagFromNeuron(neuronId, tagId);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/neurons/{neuronId}/tags")
    public ResponseEntity<List<TagResponse>> getTagsForNeuron(@PathVariable UUID neuronId) {
        return ResponseEntity.ok(tagService.getTagsForNeuron(neuronId));
    }
}
