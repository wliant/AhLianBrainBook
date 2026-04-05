package com.wliant.brainbook.service;

import com.wliant.brainbook.config.SandboxConfig;
import com.wliant.brainbook.repository.ClusterRepository;
import com.wliant.brainbook.repository.ProjectConfigRepository;
import com.wliant.brainbook.repository.SandboxRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneId;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.assertThatCode;

@ExtendWith(MockitoExtension.class)
class SandboxServiceTest {

    @Mock private SandboxRepository sandboxRepository;
    @Mock private ClusterRepository clusterRepository;
    @Mock private ProjectConfigRepository projectConfigRepository;
    @Mock private GitOperationService gitOperationService;
    @Mock private SandboxCloneService sandboxCloneService;
    @Mock private SandboxConfig config;

    private SandboxService sandboxService;

    @BeforeEach
    void setUp() {
        Clock clock = Clock.fixed(Instant.parse("2025-06-15T10:00:00Z"), ZoneId.of("UTC"));
        sandboxService = new SandboxService(
                sandboxRepository, clusterRepository, projectConfigRepository,
                gitOperationService, sandboxCloneService, config, clock);
    }

    // --- SSRF Prevention: validateRepoUrl ---

    @Test
    void validateRepoUrl_null_throws() {
        assertThatThrownBy(() -> sandboxService.validateRepoUrl(null))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("required");
    }

    @Test
    void validateRepoUrl_blank_throws() {
        assertThatThrownBy(() -> sandboxService.validateRepoUrl("   "))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("required");
    }

    @Test
    void validateRepoUrl_httpScheme_throws() {
        assertThatThrownBy(() -> sandboxService.validateRepoUrl("http://github.com/user/repo"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("HTTPS");
    }

    @Test
    void validateRepoUrl_fileScheme_throws() {
        assertThatThrownBy(() -> sandboxService.validateRepoUrl("file:///etc/passwd"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("HTTPS");
    }

    @Test
    void validateRepoUrl_gitScheme_throws() {
        assertThatThrownBy(() -> sandboxService.validateRepoUrl("git://github.com/user/repo"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("HTTPS");
    }

    @Test
    void validateRepoUrl_sshScheme_throws() {
        assertThatThrownBy(() -> sandboxService.validateRepoUrl("ssh://git@github.com/user/repo"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("HTTPS");
    }

    @Test
    void validateRepoUrl_localhost_throws() {
        assertThatThrownBy(() -> sandboxService.validateRepoUrl("https://localhost/repo"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("local address");
    }

    @Test
    void validateRepoUrl_dockerInternal_throws() {
        assertThatThrownBy(() -> sandboxService.validateRepoUrl("https://host.docker.internal/repo"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("local address");
    }

    @Test
    void validateRepoUrl_missingHost_throws() {
        assertThatThrownBy(() -> sandboxService.validateRepoUrl("https:///path"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("missing host");
    }

    @Test
    void validateRepoUrl_validHttps_passes() {
        // This will attempt DNS resolution of github.com — should pass on any machine with internet
        assertThatCode(() -> sandboxService.validateRepoUrl("https://github.com/user/repo.git"))
                .doesNotThrowAnyException();
    }
}
