package com.wliant.brainbook.service;

import com.wliant.brainbook.dto.TemplateRequest;
import com.wliant.brainbook.dto.TemplateResponse;
import com.wliant.brainbook.exception.ResourceNotFoundException;
import com.wliant.brainbook.model.Template;
import com.wliant.brainbook.repository.TemplateRepository;
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
        template.setName(req.name());
        template.setDescription(req.description());
        template.setContentJson(req.contentJson());
        Template saved = templateRepository.save(template);
        return toResponse(saved);
    }

    public TemplateResponse update(UUID id, TemplateRequest req) {
        Template template = templateRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Template not found: " + id));
        template.setName(req.name());
        template.setDescription(req.description());
        template.setContentJson(req.contentJson());
        Template saved = templateRepository.save(template);
        return toResponse(saved);
    }

    public void delete(UUID id) {
        Template template = templateRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Template not found: " + id));
        templateRepository.delete(template);
    }

    private TemplateResponse toResponse(Template template) {
        return new TemplateResponse(
                template.getId(),
                template.getName(),
                template.getDescription(),
                template.getContentJson(),
                template.getCreatedAt(),
                template.getUpdatedAt()
        );
    }
}
