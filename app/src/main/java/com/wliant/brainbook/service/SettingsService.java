package com.wliant.brainbook.service;

import com.wliant.brainbook.dto.AppSettingsRequest;
import com.wliant.brainbook.dto.AppSettingsResponse;
import com.wliant.brainbook.model.AppSettings;
import com.wliant.brainbook.repository.AppSettingsRepository;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional
public class SettingsService {

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
        if (req.editorMode() != null) {
            settings.setEditorMode(req.editorMode());
        }
        AppSettings saved = appSettingsRepository.save(settings);
        return toResponse(saved);
    }

    private AppSettingsResponse toResponse(AppSettings settings) {
        return new AppSettingsResponse(
                settings.getDisplayName(),
                settings.getEditorMode(),
                settings.getCreatedAt(),
                settings.getUpdatedAt()
        );
    }
}
