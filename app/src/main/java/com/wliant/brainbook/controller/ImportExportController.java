package com.wliant.brainbook.controller;

import com.wliant.brainbook.dto.BrainExportDto;
import com.wliant.brainbook.dto.BrainImportDto;
import com.wliant.brainbook.dto.BrainResponse;
import com.wliant.brainbook.service.ImportExportService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
@RequestMapping("/api/brains")
public class ImportExportController {

    private final ImportExportService importExportService;

    public ImportExportController(ImportExportService importExportService) {
        this.importExportService = importExportService;
    }

    @GetMapping("/{id}/export")
    public BrainExportDto exportBrain(@PathVariable UUID id) {
        return importExportService.exportBrain(id);
    }

    @PostMapping("/import")
    public ResponseEntity<BrainResponse> importBrain(@Valid @RequestBody BrainImportDto request) {
        BrainResponse response = importExportService.importBrain(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }
}
