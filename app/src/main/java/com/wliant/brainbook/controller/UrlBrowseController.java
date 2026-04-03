package com.wliant.brainbook.controller;

import com.wliant.brainbook.dto.FileContentResponse;
import com.wliant.brainbook.dto.FileTreeEntryResponse;
import com.wliant.brainbook.service.UrlBrowseService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/clusters/{clusterId}/browse")
public class UrlBrowseController {

    private final UrlBrowseService urlBrowseService;

    public UrlBrowseController(UrlBrowseService urlBrowseService) {
        this.urlBrowseService = urlBrowseService;
    }

    @GetMapping("/tree")
    public ResponseEntity<List<FileTreeEntryResponse>> getTree(
            @PathVariable UUID clusterId,
            @RequestParam(required = false) String ref) {
        return ResponseEntity.ok(urlBrowseService.getTree(clusterId, ref));
    }

    @GetMapping("/file")
    public ResponseEntity<FileContentResponse> getFile(
            @PathVariable UUID clusterId,
            @RequestParam String path,
            @RequestParam(required = false) String ref) {
        return ResponseEntity.ok(urlBrowseService.getFile(clusterId, ref, path));
    }

    @GetMapping("/branches")
    public ResponseEntity<List<Map<String, String>>> getBranches(
            @PathVariable UUID clusterId) {
        return ResponseEntity.ok(urlBrowseService.getBranches(clusterId));
    }
}
