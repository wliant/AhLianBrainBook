package com.wliant.brainbook.service;

import com.wliant.brainbook.config.SandboxConfig;
import com.wliant.brainbook.model.Sandbox;
import com.wliant.brainbook.model.SandboxStatus;
import com.wliant.brainbook.repository.SandboxRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.Clock;
import java.time.LocalDateTime;
import java.util.List;

@Service
public class SandboxCleanupScheduler {

    private static final Logger log = LoggerFactory.getLogger(SandboxCleanupScheduler.class);

    private final SandboxRepository sandboxRepository;
    private final SandboxService sandboxService;
    private final SandboxConfig config;
    private final Clock clock;

    public SandboxCleanupScheduler(SandboxRepository sandboxRepository,
                                   SandboxService sandboxService,
                                   SandboxConfig config,
                                   Clock clock) {
        this.sandboxRepository = sandboxRepository;
        this.sandboxService = sandboxService;
        this.config = config;
        this.clock = clock;
    }

    @Scheduled(cron = "0 0 3 * * *") // Daily at 3 AM
    public void cleanupStaleSandboxes() {
        LocalDateTime threshold = LocalDateTime.now(clock).minusDays(config.getStaleDays());
        List<Sandbox> stale = sandboxRepository.findByLastAccessedAtBeforeAndStatus(
                threshold, SandboxStatus.ACTIVE);

        if (stale.isEmpty()) {
            return;
        }

        log.info("Found {} stale sandbox(es) to clean up", stale.size());

        int cleaned = 0;
        for (Sandbox sandbox : stale) {
            try {
                sandboxService.terminate(sandbox.getClusterId());
                cleaned++;
                log.info("Cleaned up stale sandbox {} for cluster {}", sandbox.getId(), sandbox.getClusterId());
            } catch (Exception e) {
                log.error("Failed to clean up sandbox {}: {}", sandbox.getId(), e.getMessage(), e);
            }
        }

        log.info("Sandbox cleanup completed: {}/{} terminated", cleaned, stale.size());
    }
}
