package com.wliant.brainbook.service;

import com.wliant.brainbook.config.SandboxConfig;
import com.wliant.brainbook.model.Sandbox;
import com.wliant.brainbook.model.SandboxStatus;
import com.wliant.brainbook.repository.SandboxRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.List;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class SandboxCleanupSchedulerTest {

    @Mock
    private SandboxService sandboxService;

    @Mock
    private SandboxRepository sandboxRepository;

    @Mock
    private SandboxConfig sandboxConfig;

    private SandboxCleanupScheduler scheduler;
    private Clock clock;

    @BeforeEach
    void setUp() {
        clock = Clock.fixed(Instant.parse("2025-06-15T03:00:00Z"), ZoneId.of("UTC"));
        scheduler = new SandboxCleanupScheduler(sandboxRepository, sandboxService, sandboxConfig, clock);
    }

    @Test
    void noStaleSandboxes_noTerminations() {
        when(sandboxConfig.getStaleDays()).thenReturn(30);
        when(sandboxRepository.findByLastAccessedAtBeforeAndStatus(any(LocalDateTime.class), any(SandboxStatus.class)))
                .thenReturn(List.of());

        scheduler.cleanupStaleSandboxes();

        verify(sandboxService, never()).terminate(any());
    }

    @Test
    void staleSandbox_terminated() {
        when(sandboxConfig.getStaleDays()).thenReturn(30);
        UUID clusterId = UUID.randomUUID();
        Sandbox stale = mockSandbox(UUID.randomUUID(), clusterId);
        when(sandboxRepository.findByLastAccessedAtBeforeAndStatus(any(LocalDateTime.class), any(SandboxStatus.class)))
                .thenReturn(List.of(stale));

        scheduler.cleanupStaleSandboxes();

        verify(sandboxService).terminate(clusterId);
    }

    @Test
    void exceptionCaught_continuesOthers() {
        when(sandboxConfig.getStaleDays()).thenReturn(30);
        UUID cid1 = UUID.randomUUID();
        UUID cid2 = UUID.randomUUID();
        Sandbox s1 = mockSandbox(UUID.randomUUID(), cid1);
        Sandbox s2 = mockSandbox(UUID.randomUUID(), cid2);
        when(sandboxRepository.findByLastAccessedAtBeforeAndStatus(any(LocalDateTime.class), any(SandboxStatus.class)))
                .thenReturn(List.of(s1, s2));
        doThrow(new RuntimeException("boom")).when(sandboxService).terminate(cid1);

        scheduler.cleanupStaleSandboxes();

        verify(sandboxService).terminate(cid2);
    }

    private Sandbox mockSandbox(UUID id, UUID clusterId) {
        Sandbox s = mock(Sandbox.class);
        when(s.getId()).thenReturn(id);
        when(s.getClusterId()).thenReturn(clusterId);
        return s;
    }
}
