package com.wliant.brainbook.service;

import com.wliant.brainbook.dto.AppSettingsRequest;
import com.wliant.brainbook.dto.AppSettingsResponse;
import com.wliant.brainbook.model.AppSettings;
import com.wliant.brainbook.repository.AppSettingsRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional
public class SettingsService {

    private static final Logger log = LoggerFactory.getLogger(SettingsService.class);

    private final AppSettingsRepository appSettingsRepository;

    public SettingsService(AppSettingsRepository appSettingsRepository) {
        this.appSettingsRepository = appSettingsRepository;
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
        AppSettings saved = appSettingsRepository.save(settings);
        return toResponse(saved);
    }

    public int getMaxRemindersPerNeuron() {
        return appSettingsRepository.findAll().getFirst().getMaxRemindersPerNeuron();
    }

    public String getTimezone() {
        return appSettingsRepository.findAll().getFirst().getTimezone();
    }

    private AppSettingsResponse toResponse(AppSettings settings) {
        return new AppSettingsResponse(
                settings.getDisplayName(),
                settings.getMaxRemindersPerNeuron(),
                settings.getTimezone(),
                settings.getCreatedAt(),
                settings.getUpdatedAt()
        );
    }
}
