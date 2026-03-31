package com.wliant.brainbook.controller;

import com.wliant.brainbook.service.MarkdownExportService;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
@RequestMapping("/api")
public class ExportController {

    private final MarkdownExportService markdownExportService;

    public ExportController(MarkdownExportService markdownExportService) {
        this.markdownExportService = markdownExportService;
    }

    @GetMapping(value = "/neurons/{id}/export/markdown", produces = "text/markdown")
    public ResponseEntity<String> exportNeuronAsMarkdown(@PathVariable UUID id) {
        String markdown = markdownExportService.exportNeuronAsMarkdown(id);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"neuron.md\"")
                .contentType(MediaType.parseMediaType("text/markdown; charset=UTF-8"))
                .body(markdown);
    }

    @GetMapping(value = "/brains/{id}/export/markdown", produces = "application/zip")
    public ResponseEntity<byte[]> exportBrainAsMarkdown(@PathVariable UUID id) {
        byte[] zip = markdownExportService.exportBrainAsMarkdownZip(id);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"brain-export.zip\"")
                .contentType(MediaType.parseMediaType("application/zip"))
                .body(zip);
    }
}
