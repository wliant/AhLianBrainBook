package com.wliant.brainbook.controller;

import com.wliant.brainbook.dto.ProjectConfigResponse;
import com.wliant.brainbook.dto.UpdateProjectConfigRequest;
import com.wliant.brainbook.service.ProjectConfigService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/clusters/{clusterId}/project-config")
public class ProjectConfigController {

    private final ProjectConfigService projectConfigService;

    public ProjectConfigController(ProjectConfigService projectConfigService) {
        this.projectConfigService = projectConfigService;
    }

    @GetMapping
    public ResponseEntity<ProjectConfigResponse> get(@PathVariable UUID clusterId) {
        return ResponseEntity.ok(projectConfigService.getByClusterId(clusterId));
    }

    @PatchMapping
    public ResponseEntity<ProjectConfigResponse> update(@PathVariable UUID clusterId,
                                                         @Valid @RequestBody UpdateProjectConfigRequest req) {
        return ResponseEntity.ok(projectConfigService.update(clusterId, req));
    }
}
