package com.wliant.brainbook.service;

import com.wliant.brainbook.config.DatabaseCleaner;
import com.wliant.brainbook.config.TestContainersConfig;
import com.wliant.brainbook.dto.AppSettingsRequest;
import com.wliant.brainbook.dto.AppSettingsResponse;
import io.minio.MinioClient;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
@Import(TestContainersConfig.class)
@ActiveProfiles("test")
class SettingsServiceTest {

    @MockitoBean
    private MinioClient minioClient;

    @Autowired
    private SettingsService settingsService;

    @Autowired
    private DatabaseCleaner databaseCleaner;

    @BeforeEach
    void setUp() {
        databaseCleaner.clean();
    }

    @Test
    void getSettings_returnsDefaults() {
        AppSettingsResponse response = settingsService.getSettings();

        assertThat(response.displayName()).isEqualTo("user");
        assertThat(response.maxRemindersPerNeuron()).isEqualTo(10);
        assertThat(response.timezone()).isEqualTo("Asia/Singapore");
    }

    @Test
    void updateSettings_displayNameOnly() {
        AppSettingsResponse response = settingsService.updateSettings(
                new AppSettingsRequest("Alice", null, null));

        assertThat(response.displayName()).isEqualTo("Alice");
        assertThat(response.maxRemindersPerNeuron()).isEqualTo(10);
        assertThat(response.timezone()).isEqualTo("Asia/Singapore");
    }

    @Test
    void updateSettings_maxRemindersOnly() {
        AppSettingsResponse response = settingsService.updateSettings(
                new AppSettingsRequest(null, 5, null));

        assertThat(response.maxRemindersPerNeuron()).isEqualTo(5);
        assertThat(response.displayName()).isEqualTo("user");
    }

    @Test
    void updateSettings_timezoneOnly() {
        AppSettingsResponse response = settingsService.updateSettings(
                new AppSettingsRequest(null, null, "America/New_York"));

        assertThat(response.timezone()).isEqualTo("America/New_York");
    }

    @Test
    void getDisplayName_returnsValue() {
        String displayName = settingsService.getDisplayName();

        assertThat(displayName).isEqualTo("user");
    }

    @Test
    void getDisplayName_afterUpdate_returnsNewValue() {
        settingsService.updateSettings(new AppSettingsRequest("Bob", null, null));

        String displayName = settingsService.getDisplayName();

        assertThat(displayName).isEqualTo("Bob");
    }

    @Test
    void getMaxRemindersPerNeuron_returnsValue() {
        int max = settingsService.getMaxRemindersPerNeuron();

        assertThat(max).isEqualTo(10);
    }

    @Test
    void getTimezone_returnsValue() {
        String tz = settingsService.getTimezone();

        assertThat(tz).isEqualTo("Asia/Singapore");
    }
}
