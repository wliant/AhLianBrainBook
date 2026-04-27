package com.wliant.brainbook.service;

import com.wliant.brainbook.config.DatabaseCleaner;
import com.wliant.brainbook.config.TestContainersConfig;
import com.wliant.brainbook.config.TestDataFactory;
import com.wliant.brainbook.dto.AppSettingsRequest;
import com.wliant.brainbook.dto.AppSettingsResponse;
import com.wliant.brainbook.dto.BrainResponse;
import com.wliant.brainbook.dto.ClusterResponse;
import com.wliant.brainbook.exception.ResourceNotFoundException;
import io.minio.MinioClient;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

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

    @Autowired
    private TestDataFactory testDataFactory;

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
        assertThat(response.defaultShareClusterId()).isNull();
        assertThat(response.defaultShareBrainId()).isNull();
    }

    @Test
    void updateSettings_displayNameOnly() {
        AppSettingsResponse response = settingsService.updateSettings(
                new AppSettingsRequest("Alice", null, null, null, null, null));

        assertThat(response.displayName()).isEqualTo("Alice");
        assertThat(response.maxRemindersPerNeuron()).isEqualTo(10);
        assertThat(response.timezone()).isEqualTo("Asia/Singapore");
    }

    @Test
    void updateSettings_maxRemindersOnly() {
        AppSettingsResponse response = settingsService.updateSettings(
                new AppSettingsRequest(null, 5, null, null, null, null));

        assertThat(response.maxRemindersPerNeuron()).isEqualTo(5);
        assertThat(response.displayName()).isEqualTo("user");
    }

    @Test
    void updateSettings_timezoneOnly() {
        AppSettingsResponse response = settingsService.updateSettings(
                new AppSettingsRequest(null, null, "America/New_York", null, null, null));

        assertThat(response.timezone()).isEqualTo("America/New_York");
    }

    @Test
    void getDisplayName_returnsValue() {
        String displayName = settingsService.getDisplayName();

        assertThat(displayName).isEqualTo("user");
    }

    @Test
    void getDisplayName_afterUpdate_returnsNewValue() {
        settingsService.updateSettings(new AppSettingsRequest("Bob", null, null, null, null, null));

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

    @Test
    void aiToolsEnabled_defaultFalse() {
        AppSettingsResponse response = settingsService.getSettings();

        assertThat(response.aiToolsEnabled()).isFalse();
    }

    @Test
    void updateSettings_togglesAiToolsEnabled() {
        settingsService.updateSettings(new AppSettingsRequest(null, null, null, true, null, null));

        assertThat(settingsService.isAiToolsEnabled()).isTrue();
        assertThat(settingsService.getSettings().aiToolsEnabled()).isTrue();

        settingsService.updateSettings(new AppSettingsRequest(null, null, null, false, null, null));

        assertThat(settingsService.isAiToolsEnabled()).isFalse();
    }

    @Test
    void updateSettings_nullAiToolsEnabled_doesNotChange() {
        settingsService.updateSettings(new AppSettingsRequest(null, null, null, true, null, null));
        settingsService.updateSettings(new AppSettingsRequest("NewName", null, null, null, null, null));

        assertThat(settingsService.isAiToolsEnabled()).isTrue();
        assertThat(settingsService.getSettings().displayName()).isEqualTo("NewName");
    }

    @Test
    void updateSettings_setsDefaultShareCluster_andDerivesBrainId() {
        BrainResponse brain = testDataFactory.createBrain();
        ClusterResponse cluster = testDataFactory.createCluster(brain.id());

        AppSettingsResponse response = settingsService.updateSettings(
                new AppSettingsRequest(null, null, null, null, cluster.id(), null));

        assertThat(response.defaultShareClusterId()).isEqualTo(cluster.id());
        assertThat(response.defaultShareBrainId()).isEqualTo(brain.id());
    }

    @Test
    void updateSettings_invalidClusterId_throws() {
        UUID nonExistent = UUID.randomUUID();

        assertThatThrownBy(() -> settingsService.updateSettings(
                new AppSettingsRequest(null, null, null, null, nonExistent, null)))
                .isInstanceOf(ResourceNotFoundException.class);
    }

    @Test
    void updateSettings_omittingShareCluster_preservesValue() {
        BrainResponse brain = testDataFactory.createBrain();
        ClusterResponse cluster = testDataFactory.createCluster(brain.id());
        settingsService.updateSettings(new AppSettingsRequest(null, null, null, null, cluster.id(), null));

        settingsService.updateSettings(new AppSettingsRequest("Renamed", null, null, null, null, null));

        AppSettingsResponse response = settingsService.getSettings();
        assertThat(response.defaultShareClusterId()).isEqualTo(cluster.id());
        assertThat(response.displayName()).isEqualTo("Renamed");
    }

    @Test
    void updateSettings_clearDefaultShareCluster() {
        BrainResponse brain = testDataFactory.createBrain();
        ClusterResponse cluster = testDataFactory.createCluster(brain.id());
        settingsService.updateSettings(new AppSettingsRequest(null, null, null, null, cluster.id(), null));

        AppSettingsResponse response = settingsService.updateSettings(
                new AppSettingsRequest(null, null, null, null, null, true));

        assertThat(response.defaultShareClusterId()).isNull();
        assertThat(response.defaultShareBrainId()).isNull();
    }
}
