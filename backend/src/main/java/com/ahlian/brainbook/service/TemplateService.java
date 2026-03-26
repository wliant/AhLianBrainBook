package com.ahlian.brainbook.service;

import com.ahlian.brainbook.dto.TemplateRequest;
import com.ahlian.brainbook.dto.TemplateResponse;
import com.ahlian.brainbook.exception.ResourceNotFoundException;
import com.ahlian.brainbook.model.Template;
import com.ahlian.brainbook.repository.TemplateRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@Transactional
public class TemplateService {

    private final TemplateRepository templateRepository;

    public TemplateService(TemplateRepository templateRepository) {
        this.templateRepository = templateRepository;
    }

    public List<TemplateResponse> getAll() {
        return templateRepository.findAllByOrderByNameAsc().stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    public TemplateResponse getById(UUID id) {
        Template template = templateRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Template not found: " + id));
        return toResponse(template);
    }

    public TemplateResponse create(TemplateRequest req) {
        Template template = new Template();
        template.setName(req.getName());
        template.setDescription(req.getDescription());
        template.setContentJson(req.getContentJson());
        Template saved = templateRepository.save(template);
        return toResponse(saved);
    }

    public TemplateResponse update(UUID id, TemplateRequest req) {
        Template template = templateRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Template not found: " + id));
        template.setName(req.getName());
        template.setDescription(req.getDescription());
        template.setContentJson(req.getContentJson());
        Template saved = templateRepository.save(template);
        return toResponse(saved);
    }

    public void delete(UUID id) {
        Template template = templateRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Template not found: " + id));
        templateRepository.delete(template);
    }

    private TemplateResponse toResponse(Template template) {
        TemplateResponse resp = new TemplateResponse();
        resp.setId(template.getId());
        resp.setName(template.getName());
        resp.setDescription(template.getDescription());
        resp.setContentJson(template.getContentJson());
        resp.setCreatedAt(template.getCreatedAt());
        resp.setUpdatedAt(template.getUpdatedAt());
        return resp;
    }
}
