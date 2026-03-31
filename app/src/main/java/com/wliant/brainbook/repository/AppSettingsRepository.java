package com.wliant.brainbook.repository;

import com.wliant.brainbook.model.AppSettings;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

public interface AppSettingsRepository extends JpaRepository<AppSettings, UUID> {
}
