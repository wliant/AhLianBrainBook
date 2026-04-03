package com.wliant.brainbook.service;

import com.wliant.brainbook.dto.ProjectConfigResponse;
import com.wliant.brainbook.dto.UpdateProjectConfigRequest;
import com.wliant.brainbook.exception.ResourceNotFoundException;
import com.wliant.brainbook.model.ProjectConfig;
import com.wliant.brainbook.repository.ProjectConfigRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Service
@Transactional
public class ProjectConfigService {

    private final ProjectConfigRepository projectConfigRepository;

    public ProjectConfigService(ProjectConfigRepository projectConfigRepository) {
        this.projectConfigRepository = projectConfigRepository;
    }

    public ProjectConfigResponse getByClusterId(UUID clusterId) {
        ProjectConfig config = projectConfigRepository.findByClusterId(clusterId)
                .orElseThrow(() -> new ResourceNotFoundException("Project config not found for cluster: " + clusterId));
        return toResponse(config);
    }

    public ProjectConfigResponse update(UUID clusterId, UpdateProjectConfigRequest req) {
        ProjectConfig config = projectConfigRepository.findByClusterId(clusterId)
                .orElseThrow(() -> new ResourceNotFoundException("Project config not found for cluster: " + clusterId));

        if (req.defaultBranch() != null) {
            config.setDefaultBranch(req.defaultBranch());
        }

        ProjectConfig saved = projectConfigRepository.save(config);
        return toResponse(saved);
    }

    private ProjectConfigResponse toResponse(ProjectConfig config) {
        return new ProjectConfigResponse(
                config.getId(),
                config.getCluster() != null ? config.getCluster().getId() : config.getClusterId(),
                config.getRepoUrl(),
                config.getDefaultBranch(),
                config.getCreatedAt(),
                config.getUpdatedAt()
        );
    }
}
