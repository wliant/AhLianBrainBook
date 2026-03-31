package com.wliant.brainbook.service;

import com.wliant.brainbook.dto.NotificationResponse;
import com.wliant.brainbook.exception.ResourceNotFoundException;
import com.wliant.brainbook.model.Neuron;
import com.wliant.brainbook.model.Notification;
import com.wliant.brainbook.model.Reminder;
import com.wliant.brainbook.repository.NotificationRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class NotificationService {

    private static final Logger log = LoggerFactory.getLogger(NotificationService.class);

    private final NotificationRepository notificationRepository;
    private final NotificationSseService notificationSseService;

    public NotificationService(NotificationRepository notificationRepository,
                                NotificationSseService notificationSseService) {
        this.notificationRepository = notificationRepository;
        this.notificationSseService = notificationSseService;
    }

    @Transactional(readOnly = true)
    public List<NotificationResponse> getAll(int page, int size) {
        return notificationRepository.findAllByOrderByCreatedAtDesc(PageRequest.of(page, size))
                .stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public long getUnreadCount() {
        return notificationRepository.countByIsReadFalse();
    }

    @Transactional
    public void markAsRead(UUID id) {
        Notification notification = notificationRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Notification not found: " + id));
        notification.setRead(true);
        notificationRepository.save(notification);
        broadcastUnreadCount();
    }

    @Transactional
    public void markAllAsRead() {
        int updated = notificationRepository.markAllAsRead();
        log.info("Marked {} notification(s) as read", updated);
        broadcastUnreadCount();
    }

    private void broadcastUnreadCount() {
        long count = notificationRepository.countByIsReadFalse();
        notificationSseService.broadcast("unread-count", Map.of("count", count));
    }

    @Transactional
    public void create(Reminder reminder, Neuron neuron) {
        // Use direct ID fields to avoid lazy-loading issues
        UUID brainId = neuron.getBrainId();
        UUID clusterId = neuron.getClusterId();

        if (brainId == null || clusterId == null) {
            log.warn("Creating notification with incomplete references: reminder={}, brainId={}, clusterId={}",
                    reminder.getId(), brainId, clusterId);
        }

        Notification notification = new Notification();
        notification.setReminderId(reminder.getId());
        notification.setNeuronId(neuron.getId());
        notification.setBrainId(brainId);
        notification.setClusterId(clusterId);
        notification.setNeuronTitle(neuron.getTitle());
        notification.setMessage("Reminder: " + neuron.getTitle());
        notification.setRead(false);
        notificationRepository.save(notification);

        long unreadCount = notificationRepository.countByIsReadFalse();
        notificationSseService.broadcast("new-notification", Map.of(
                "count", unreadCount,
                "neuronTitle", neuron.getTitle(),
                "message", notification.getMessage()
        ));
    }

    private NotificationResponse toResponse(Notification n) {
        return new NotificationResponse(
                n.getId(),
                n.getReminderId(),
                n.getNeuronId(),
                n.getBrainId(),
                n.getClusterId(),
                n.getNeuronTitle(),
                n.getMessage(),
                n.isRead(),
                n.getCreatedAt()
        );
    }
}
