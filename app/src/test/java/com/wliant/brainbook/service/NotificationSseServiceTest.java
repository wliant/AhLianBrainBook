package com.wliant.brainbook.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class NotificationSseServiceTest {

    private NotificationSseService sseService;

    @BeforeEach
    void setUp() {
        sseService = new NotificationSseService();
    }

    @Test
    void createEmitter_registersEmitter() {
        SseEmitter emitter = sseService.createEmitter();

        assertThat(emitter).isNotNull();
        assertThat(sseService.getActiveEmitterCount()).isEqualTo(1);
    }

    @Test
    void createEmitter_multipleEmitters() {
        sseService.createEmitter();
        sseService.createEmitter();
        sseService.createEmitter();

        assertThat(sseService.getActiveEmitterCount()).isEqualTo(3);
    }

    @Test
    void broadcast_doesNotThrowWithActiveEmitters() {
        sseService.createEmitter();
        sseService.createEmitter();

        // Broadcasting to active emitters should work without error
        // (In a unit test context without servlet container, emitters accept sends)
        sseService.broadcast("test-event", Map.of("key", "value"));

        // Emitters should still be registered
        assertThat(sseService.getActiveEmitterCount()).isEqualTo(2);
    }

    @Test
    void broadcast_handlesNoEmitters() {
        // Should not throw when no emitters are registered
        sseService.broadcast("test", Map.of("key", "value"));

        assertThat(sseService.getActiveEmitterCount()).isEqualTo(0);
    }
}
