package com.ahlian.brainbook.controller;

import com.ahlian.brainbook.dto.TemplateRequest;
import com.ahlian.brainbook.dto.TemplateResponse;
import com.ahlian.brainbook.service.TemplateService;
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
@RequestMapping("/api/templates")
public class TemplateController {

    private final TemplateService templateService;

    public TemplateController(TemplateService templateService) {
        this.templateService = templateService;
    }

    @GetMapping
    public ResponseEntity<List<TemplateResponse>> listTemplates() {
        return ResponseEntity.ok(templateService.getAll());
    }

    @PostMapping
    public ResponseEntity<TemplateResponse> createTemplate(@Valid @RequestBody TemplateRequest req) {
        return ResponseEntity.status(HttpStatus.CREATED).body(templateService.create(req));
    }

    @GetMapping("/{id}")
    public ResponseEntity<TemplateResponse> getTemplate(@PathVariable UUID id) {
        return ResponseEntity.ok(templateService.getById(id));
    }

    @PatchMapping("/{id}")
    public ResponseEntity<TemplateResponse> updateTemplate(@PathVariable UUID id,
                                                           @Valid @RequestBody TemplateRequest req) {
        return ResponseEntity.ok(templateService.update(id, req));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteTemplate(@PathVariable UUID id) {
        templateService.delete(id);
        return ResponseEntity.noContent().build();
    }
}
