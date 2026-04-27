package com.wliant.brainbook.controller;

import com.wliant.brainbook.config.DatabaseCleaner;
import com.wliant.brainbook.config.TestContainersConfig;
import com.wliant.brainbook.dto.AppSettingsRequest;
import com.wliant.brainbook.dto.AppSettingsResponse;
import io.minio.MinioClient;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@Import(TestContainersConfig.class)
@ActiveProfiles("test")
class SettingsControllerIntegrationTest {

    @MockitoBean
    private MinioClient minioClient;

    @Autowired
    private TestRestTemplate restTemplate;

    @Autowired
    private DatabaseCleaner databaseCleaner;

    @BeforeEach
    void setUp() {
        databaseCleaner.clean();
    }

    @Test
    void getSettings_returns200() {
        ResponseEntity<AppSettingsResponse> response = restTemplate.getForEntity(
                "/api/settings", AppSettingsResponse.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().displayName()).isEqualTo("user");
        assertThat(response.getBody().maxRemindersPerNeuron()).isEqualTo(10);
        assertThat(response.getBody().timezone()).isEqualTo("Asia/Singapore");
    }

    @Test
    void updateSettings_returns200() {
        AppSettingsRequest request = new AppSettingsRequest("Alice", 20, "UTC", null, null, null);

        ResponseEntity<AppSettingsResponse> response = restTemplate.exchange(
                "/api/settings", HttpMethod.PATCH,
                new HttpEntity<>(request), AppSettingsResponse.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody().displayName()).isEqualTo("Alice");
        assertThat(response.getBody().maxRemindersPerNeuron()).isEqualTo(20);
        assertThat(response.getBody().timezone()).isEqualTo("UTC");
    }

    @Test
    void updateSettings_invalidMaxReminders_returns400() {
        AppSettingsRequest request = new AppSettingsRequest(null, 0, null, null, null, null);

        ResponseEntity<String> response = restTemplate.exchange(
                "/api/settings", HttpMethod.PATCH,
                new HttpEntity<>(request), String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
    }

    @Test
    void updateSettings_tooLongDisplayName_returns400() {
        String longName = "A".repeat(101);
        AppSettingsRequest request = new AppSettingsRequest(longName, null, null, null, null, null);

        ResponseEntity<String> response = restTemplate.exchange(
                "/api/settings", HttpMethod.PATCH,
                new HttpEntity<>(request), String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
    }
}
