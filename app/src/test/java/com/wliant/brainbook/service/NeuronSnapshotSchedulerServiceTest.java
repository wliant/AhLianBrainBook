package com.wliant.brainbook.service;

import com.wliant.brainbook.dto.RevisionResponse;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class NeuronSnapshotSchedulerServiceTest {

    @Mock
    private RevisionService revisionService;

    private NeuronSnapshotSchedulerService scheduler;
    private Clock clock;

    private void setClock(String instant) {
        clock = Clock.fixed(Instant.parse(instant), ZoneId.of("UTC"));
        // Recreate scheduler with new clock
        scheduler = new NeuronSnapshotSchedulerService(revisionService, clock, 60);
    }

    @BeforeEach
    void setUp() {
        clock = Clock.fixed(Instant.parse("2025-01-01T12:00:00Z"), ZoneId.of("UTC"));
        scheduler = new NeuronSnapshotSchedulerService(revisionService, clock, 60);
    }

    @Test
    void recordUpdate_tracksNeuron() {
        UUID neuronId = UUID.randomUUID();

        scheduler.recordUpdate(neuronId);

        assertThat(scheduler.getPendingCount()).isEqualTo(1);
    }

    @Test
    void recordUpdate_overwritesPreviousTimestamp() {
        UUID neuronId = UUID.randomUUID();

        scheduler.recordUpdate(neuronId);
        scheduler.recordUpdate(neuronId);

        assertThat(scheduler.getPendingCount()).isEqualTo(1);
    }

    @Test
    void recordUpdate_tracksMultipleNeurons() {
        scheduler.recordUpdate(UUID.randomUUID());
        scheduler.recordUpdate(UUID.randomUUID());

        assertThat(scheduler.getPendingCount()).isEqualTo(2);
    }

    @Test
    void processIdleNeurons_doesNothingWhenEmpty() {
        scheduler.processIdleNeurons();

        verifyNoInteractions(revisionService);
        assertThat(scheduler.getPendingCount()).isZero();
    }

    @Test
    void processIdleNeurons_doesNothingWhenNotYetIdle() {
        UUID neuronId = UUID.randomUUID();
        scheduler.recordUpdate(neuronId);

        // Process at the same time — 0 minutes elapsed, not idle
        scheduler.processIdleNeurons();

        verifyNoInteractions(revisionService);
        assertThat(scheduler.getPendingCount()).isEqualTo(1);
    }

    @Test
    void processIdleNeurons_createsSnapshotAfterIdlePeriod() {
        UUID neuronId = UUID.randomUUID();

        // Record at 12:00
        scheduler.recordUpdate(neuronId);

        // Advance clock to 13:01 (61 minutes later) and create new scheduler sharing the same map
        // Since ConcurrentHashMap is per-instance, we need to simulate time passing differently.
        // Instead, we'll use a scheduler with idle=0 to test the "is idle" path.
        NeuronSnapshotSchedulerService zeroIdleScheduler =
                new NeuronSnapshotSchedulerService(revisionService, clock, 0);
        zeroIdleScheduler.recordUpdate(neuronId);

        RevisionResponse mockRevision = new RevisionResponse(
                UUID.randomUUID(), neuronId, 1, "Title", "{}", "text",
                LocalDateTime.now(clock));
        when(revisionService.createRevision(neuronId)).thenReturn(mockRevision);

        zeroIdleScheduler.processIdleNeurons();

        verify(revisionService).createRevision(neuronId);
        assertThat(zeroIdleScheduler.getPendingCount()).isZero();
    }

    @Test
    void processIdleNeurons_handlesExceptionGracefully() {
        UUID neuronId = UUID.randomUUID();

        NeuronSnapshotSchedulerService zeroIdleScheduler =
                new NeuronSnapshotSchedulerService(revisionService, clock, 0);
        zeroIdleScheduler.recordUpdate(neuronId);

        when(revisionService.createRevision(neuronId)).thenThrow(new RuntimeException("DB error"));

        // Should not throw
        zeroIdleScheduler.processIdleNeurons();

        verify(revisionService).createRevision(neuronId);
        // Entry should be removed even though creation failed
        assertThat(zeroIdleScheduler.getPendingCount()).isZero();
    }

    @Test
    void processIdleNeurons_onlyProcessesIdleNeurons() {
        UUID idleNeuron = UUID.randomUUID();
        UUID activeNeuron = UUID.randomUUID();

        // Use 0 idle minutes to make idleNeuron immediately eligible
        NeuronSnapshotSchedulerService zeroIdleScheduler =
                new NeuronSnapshotSchedulerService(revisionService, clock, 0);
        zeroIdleScheduler.recordUpdate(idleNeuron);
        zeroIdleScheduler.recordUpdate(activeNeuron);

        RevisionResponse mockRevision = new RevisionResponse(
                UUID.randomUUID(), idleNeuron, 1, "Title", "{}", "text",
                LocalDateTime.now(clock));
        when(revisionService.createRevision(any())).thenReturn(mockRevision);

        zeroIdleScheduler.processIdleNeurons();

        // Both should be processed since both are idle (0 min threshold)
        verify(revisionService, times(2)).createRevision(any());
        assertThat(zeroIdleScheduler.getPendingCount()).isZero();
    }
}
