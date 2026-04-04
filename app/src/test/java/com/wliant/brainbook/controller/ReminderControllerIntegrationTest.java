package com.wliant.brainbook.controller;

import com.wliant.brainbook.config.DatabaseCleaner;
import com.wliant.brainbook.config.TestContainersConfig;
import com.wliant.brainbook.dto.BrainRequest;
import com.wliant.brainbook.dto.BrainResponse;
import com.wliant.brainbook.dto.ClusterResponse;
import com.wliant.brainbook.dto.CreateClusterRequest;
import com.wliant.brainbook.dto.NeuronRequest;
import com.wliant.brainbook.dto.NeuronResponse;
import com.wliant.brainbook.dto.ReminderRequest;
import com.wliant.brainbook.dto.ReminderResponse;
import com.wliant.brainbook.model.ReminderType;
import io.minio.MinioClient;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.context.annotation.Import;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@Import(TestContainersConfig.class)
@ActiveProfiles("test")
class ReminderControllerIntegrationTest {

    @MockitoBean
    private MinioClient minioClient;

    @Autowired
    private TestRestTemplate restTemplate;

    @Autowired
    private DatabaseCleaner databaseCleaner;

    private UUID neuronId;

    @BeforeEach
    void setUp() {
        databaseCleaner.clean();

        UUID brainId = restTemplate.postForEntity(
                "/api/brains",
                new BrainRequest("Test Brain", "icon", "#FF0000", null),
                BrainResponse.class).getBody().id();

        UUID clusterId = restTemplate.postForEntity(
                "/api/clusters",
                new CreateClusterRequest("Test Cluster", brainId, null, null, null),
                ClusterResponse.class).getBody().id();

        neuronId = restTemplate.postForEntity(
                "/api/neurons",
                new NeuronRequest("Test Neuron", brainId, clusterId, null, null, null, null, null),
                NeuronResponse.class).getBody().id();
    }

    private ReminderResponse createReminder(LocalDateTime triggerAt) {
        ReminderRequest req = new ReminderRequest(
                ReminderType.ONCE, triggerAt, null, null, null, null, null);
        return restTemplate.postForEntity(
                "/api/neurons/{id}/reminders", req, ReminderResponse.class, neuronId).getBody();
    }

    // ── Neuron-scoped reminder endpoints ──────────────────────────────────────

    @Test
    void createReminder_returns201() {
        ReminderRequest req = new ReminderRequest(
                ReminderType.ONCE, LocalDateTime.now().plusDays(1),
                null, null, null, null, null);

        ResponseEntity<ReminderResponse> response = restTemplate.postForEntity(
                "/api/neurons/{id}/reminders", req, ReminderResponse.class, neuronId);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        assertThat(response.getBody().id()).isNotNull();
        assertThat(response.getBody().neuronId()).isEqualTo(neuronId);
        assertThat(response.getBody().reminderType()).isEqualTo(ReminderType.ONCE);
        assertThat(response.getBody().isActive()).isTrue();
    }

    @Test
    void createReminder_persistsTitleAndDescription() {
        String descJson = "{\"type\":\"doc\",\"content\":[]}";
        ReminderRequest req = new ReminderRequest(
                ReminderType.ONCE, LocalDateTime.now().plusDays(1),
                null, null, "Buy milk", descJson, "plain text");

        ResponseEntity<ReminderResponse> response = restTemplate.postForEntity(
                "/api/neurons/{id}/reminders", req, ReminderResponse.class, neuronId);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        assertThat(response.getBody().title()).isEqualTo("Buy milk");
        assertThat(response.getBody().description()).isEqualTo(descJson);
        assertThat(response.getBody().descriptionText()).isEqualTo("plain text");
    }

    @Test
    void createReminder_returns400WhenTriggerAtInPast() {
        ReminderRequest req = new ReminderRequest(
                ReminderType.ONCE, LocalDateTime.now().minusDays(1),
                null, null, null, null, null);

        ResponseEntity<String> response = restTemplate.postForEntity(
                "/api/neurons/{id}/reminders", req, String.class, neuronId);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
    }

    @Test
    void listRemindersByNeuron_returnsList() {
        createReminder(LocalDateTime.now().plusDays(1));
        createReminder(LocalDateTime.now().plusDays(2));

        ResponseEntity<List<ReminderResponse>> response = restTemplate.exchange(
                "/api/neurons/{id}/reminders",
                HttpMethod.GET, null,
                new ParameterizedTypeReference<List<ReminderResponse>>() {},
                neuronId);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).hasSize(2);
    }

    @Test
    void updateReminder_updatesFieldsIncludingTitle() {
        ReminderResponse created = createReminder(LocalDateTime.now().plusDays(1));

        ReminderRequest updateReq = new ReminderRequest(
                ReminderType.ONCE, LocalDateTime.now().plusDays(3),
                null, null, "Updated title", null, null);

        ResponseEntity<ReminderResponse> response = restTemplate.exchange(
                "/api/neurons/{nId}/reminders/{rId}",
                HttpMethod.PUT,
                new HttpEntity<>(updateReq),
                ReminderResponse.class,
                neuronId, created.id());

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody().title()).isEqualTo("Updated title");
    }

    @Test
    void deleteReminder_returns204() {
        ReminderResponse created = createReminder(LocalDateTime.now().plusDays(1));

        ResponseEntity<Void> response = restTemplate.exchange(
                "/api/neurons/{nId}/reminders/{rId}",
                HttpMethod.DELETE, null,
                Void.class,
                neuronId, created.id());

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);
    }

    // ── Global reminders endpoint ─────────────────────────────────────────────

    @Test
    void listAllReminders_returnsGlobalList() {
        createReminder(LocalDateTime.now().plusDays(1));

        ResponseEntity<List<ReminderResponse>> response = restTemplate.exchange(
                "/api/reminders",
                HttpMethod.GET, null,
                new ParameterizedTypeReference<List<ReminderResponse>>() {});

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).hasSize(1);
    }

    @Test
    void listAllReminders_includesNeuronTitle() {
        createReminder(LocalDateTime.now().plusDays(1));

        ResponseEntity<List<ReminderResponse>> response = restTemplate.exchange(
                "/api/reminders",
                HttpMethod.GET, null,
                new ParameterizedTypeReference<List<ReminderResponse>>() {});

        assertThat(response.getBody().get(0).neuronTitle()).isEqualTo("Test Neuron");
    }

    @Test
    void listAllReminders_orderedByTriggerAtAscending() {
        createReminder(LocalDateTime.now().plusDays(5));
        createReminder(LocalDateTime.now().plusDays(1));

        ResponseEntity<List<ReminderResponse>> response = restTemplate.exchange(
                "/api/reminders",
                HttpMethod.GET, null,
                new ParameterizedTypeReference<List<ReminderResponse>>() {});

        List<ReminderResponse> body = response.getBody();
        assertThat(body).hasSize(2);
        assertThat(body.get(0).triggerAt()).isBefore(body.get(1).triggerAt());
    }

    @Test
    void listAllReminders_returnsEmptyWhenNoReminders() {
        ResponseEntity<List<ReminderResponse>> response = restTemplate.exchange(
                "/api/reminders",
                HttpMethod.GET, null,
                new ParameterizedTypeReference<List<ReminderResponse>>() {});

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).isEmpty();
    }
}
