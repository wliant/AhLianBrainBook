package com.wliant.brainbook.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class NeuronSnapshotSchedulerService {

    private static final Logger log = LoggerFactory.getLogger(NeuronSnapshotSchedulerService.class);

    private final RevisionService revisionService;
    private final ConcurrentHashMap<UUID, LocalDateTime> pendingSnapshots = new ConcurrentHashMap<>();

    @Value("${app.neuron.snapshot.idle-minutes:60}")
    private long idleMinutes;

    public NeuronSnapshotSchedulerService(RevisionService revisionService) {
        this.revisionService = revisionService;
    }

    public void recordUpdate(UUID neuronId) {
        pendingSnapshots.put(neuronId, LocalDateTime.now());
    }

    @Scheduled(fixedRate = 60000)
    public void processIdleNeurons() {
        if (pendingSnapshots.isEmpty()) {
            return;
        }

        LocalDateTime now = LocalDateTime.now();

        for (Map.Entry<UUID, LocalDateTime> entry : pendingSnapshots.entrySet()) {
            UUID neuronId = entry.getKey();
            LocalDateTime lastUpdate = entry.getValue();

            if (ChronoUnit.MINUTES.between(lastUpdate, now) >= idleMinutes) {
                // Atomically remove only if timestamp hasn't changed (no new update since we read it)
                boolean removed = pendingSnapshots.remove(neuronId, lastUpdate);
                if (removed) {
                    try {
                        revisionService.createRevision(neuronId, "auto");
                        log.info("Auto-snapshot created for neuron {}", neuronId);
                    } catch (Exception e) {
                        log.error("Failed to create auto-snapshot for neuron {}: {}", neuronId, e.getMessage(), e);
                    }
                }
            }
        }
    }
}
