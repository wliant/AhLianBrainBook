package com.wliant.brainbook.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;

@Service
public class ResearchSseService {

    private static final Logger log = LoggerFactory.getLogger(ResearchSseService.class);

    private final ConcurrentHashMap<UUID, CopyOnWriteArrayList<SseEmitter>> clusterEmitters = new ConcurrentHashMap<>();

    public SseEmitter subscribe(UUID clusterId) {
        SseEmitter emitter = new SseEmitter(300_000L); // 5 minute timeout
        clusterEmitters.computeIfAbsent(clusterId, k -> new CopyOnWriteArrayList<>()).add(emitter);
        emitter.onCompletion(() -> removeEmitter(clusterId, emitter));
        emitter.onTimeout(() -> removeEmitter(clusterId, emitter));
        emitter.onError(e -> removeEmitter(clusterId, emitter));
        return emitter;
    }

    public void emit(UUID clusterId, String eventName, Map<String, Object> data) {
        CopyOnWriteArrayList<SseEmitter> emitters = clusterEmitters.get(clusterId);
        if (emitters == null || emitters.isEmpty()) return;

        List<SseEmitter> dead = new ArrayList<>();
        for (SseEmitter emitter : emitters) {
            try {
                emitter.send(SseEmitter.event().name(eventName).data(data));
            } catch (IOException e) {
                dead.add(emitter);
            }
        }
        if (!dead.isEmpty()) {
            emitters.removeAll(dead);
            log.debug("Removed {} dead SSE emitters for cluster {}", dead.size(), clusterId);
        }
    }

    private void removeEmitter(UUID clusterId, SseEmitter emitter) {
        CopyOnWriteArrayList<SseEmitter> emitters = clusterEmitters.get(clusterId);
        if (emitters != null) {
            emitters.remove(emitter);
            if (emitters.isEmpty()) {
                clusterEmitters.remove(clusterId);
            }
        }
    }
}
