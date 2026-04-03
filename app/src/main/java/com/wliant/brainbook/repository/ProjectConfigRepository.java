package com.wliant.brainbook.repository;

import com.wliant.brainbook.model.ProjectConfig;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface ProjectConfigRepository extends JpaRepository<ProjectConfig, UUID> {

    Optional<ProjectConfig> findByClusterId(UUID clusterId);
}
