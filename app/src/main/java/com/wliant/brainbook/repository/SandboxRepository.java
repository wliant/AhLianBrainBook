package com.wliant.brainbook.repository;

import com.wliant.brainbook.model.Sandbox;
import com.wliant.brainbook.model.SandboxStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface SandboxRepository extends JpaRepository<Sandbox, UUID> {

    Optional<Sandbox> findByClusterId(UUID clusterId);

    List<Sandbox> findByStatus(SandboxStatus status);

    List<Sandbox> findByBrainId(UUID brainId);

    List<Sandbox> findByLastAccessedAtBeforeAndStatus(LocalDateTime threshold, SandboxStatus status);

    long countByStatusIn(List<SandboxStatus> statuses);
}
