package com.wliant.brainbook.service;

import com.wliant.brainbook.dto.AppSettingsRequest;
import com.wliant.brainbook.dto.AppSettingsResponse;
import com.wliant.brainbook.exception.ResourceNotFoundException;
import com.wliant.brainbook.model.AppSettings;
import com.wliant.brainbook.model.Cluster;
import com.wliant.brainbook.repository.AppSettingsRepository;
import com.wliant.brainbook.repository.ClusterRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Service
@Transactional
public class SettingsService {

    private static final Logger log = LoggerFactory.getLogger(SettingsService.class);

    private final AppSettingsRepository appSettingsRepository;
    private final ClusterRepository clusterRepository;

    public SettingsService(AppSettingsRepository appSettingsRepository, ClusterRepository clusterRepository) {
        this.appSettingsRepository = appSettingsRepository;
        this.clusterRepository = clusterRepository;
    }

    public AppSettingsResponse getSettings() {
        AppSettings settings = appSettingsRepository.findAll().getFirst();
        return toResponse(settings);
    }

    @Cacheable("settings")
    public String getDisplayName() {
        return appSettingsRepository.findAll().getFirst().getDisplayName();
    }

    @CacheEvict(value = "settings", allEntries = true)
    public AppSettingsResponse updateSettings(AppSettingsRequest req) {
        AppSettings settings = appSettingsRepository.findAll().getFirst();
        if (req.displayName() != null) {
            settings.setDisplayName(req.displayName());
        }
        if (req.maxRemindersPerNeuron() != null) {
            settings.setMaxRemindersPerNeuron(req.maxRemindersPerNeuron());
            log.info("Max reminders per neuron changed to {}", req.maxRemindersPerNeuron());
        }
        if (req.timezone() != null) {
            settings.setTimezone(req.timezone());
            log.info("Timezone changed to {}", req.timezone());
        }
        if (req.aiToolsEnabled() != null) {
            settings.setAiToolsEnabled(req.aiToolsEnabled());
            log.info("AI tools enabled changed to {}", req.aiToolsEnabled());
        }
        if (Boolean.TRUE.equals(req.clearDefaultShareCluster())) {
            settings.setDefaultShareClusterId(null);
            log.info("Default share cluster cleared");
        } else if (req.defaultShareClusterId() != null) {
            UUID clusterId = req.defaultShareClusterId();
            if (!clusterRepository.existsById(clusterId)) {
                throw new ResourceNotFoundException("Cluster not found: " + clusterId);
            }
            settings.setDefaultShareClusterId(clusterId);
            log.info("Default share cluster changed to {}", clusterId);
        }
        AppSettings saved = appSettingsRepository.save(settings);
        return toResponse(saved);
    }

    public int getMaxRemindersPerNeuron() {
        return appSettingsRepository.findAll().getFirst().getMaxRemindersPerNeuron();
    }

    public String getTimezone() {
        return appSettingsRepository.findAll().getFirst().getTimezone();
    }

    public boolean isAiToolsEnabled() {
        return appSettingsRepository.findAll().getFirst().isAiToolsEnabled();
    }

    private AppSettingsResponse toResponse(AppSettings settings) {
        UUID clusterId = settings.getDefaultShareClusterId();
        UUID brainId = null;
        if (clusterId != null) {
            Cluster cluster = clusterRepository.findById(clusterId).orElse(null);
            if (cluster != null) {
                brainId = cluster.getBrainId();
            }
        }
        return new AppSettingsResponse(
                settings.getDisplayName(),
                settings.getMaxRemindersPerNeuron(),
                settings.getTimezone(),
                settings.isAiToolsEnabled(),
                clusterId,
                brainId,
                settings.getCreatedAt(),
                settings.getUpdatedAt()
        );
    }
}
