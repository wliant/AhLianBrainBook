package com.wliant.brainbook.controller;

import com.wliant.brainbook.config.DatabaseCleaner;
import com.wliant.brainbook.config.TestContainersConfig;
import com.wliant.brainbook.dto.*;
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

import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@Import(TestContainersConfig.class)
@ActiveProfiles("test")
class TodoControllerIntegrationTest {

    @MockitoBean
    private MinioClient minioClient;

    @Autowired
    private TestRestTemplate restTemplate;

    @Autowired
    private DatabaseCleaner databaseCleaner;

    private UUID brainId;
    private UUID clusterId;
    private UUID neuronId;

    @BeforeEach
    void setUp() {
        databaseCleaner.clean();

        BrainResponse brain = restTemplate.postForEntity("/api/brains",
                new BrainRequest("Test Brain", null, null, null), BrainResponse.class).getBody();
        brainId = brain.id();

        ClusterResponse cluster = restTemplate.postForEntity("/api/clusters",
                new CreateClusterRequest("Test Cluster", brainId, null, null, null),
                ClusterResponse.class).getBody();
        clusterId = cluster.id();

        NeuronResponse neuron = restTemplate.postForEntity("/api/neurons",
                new NeuronRequest("Test Neuron", brainId, clusterId, null, null, null, null, null),
                NeuronResponse.class).getBody();
        neuronId = neuron.id();
    }

    @Test
    void getOrCreateTodoMetadata_returns200() {
        ResponseEntity<TodoMetadataResponse> response = restTemplate.getForEntity(
                "/api/neurons/{neuronId}/todo", TodoMetadataResponse.class, neuronId);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().neuronId()).isEqualTo(neuronId);
        assertThat(response.getBody().completed()).isFalse();
        assertThat(response.getBody().priority()).isEqualTo("normal");
    }

    @Test
    void updateTodoMetadata_returns200() {
        // Ensure metadata exists first
        restTemplate.getForEntity("/api/neurons/{neuronId}/todo",
                TodoMetadataResponse.class, neuronId);

        TodoMetadataRequest request = new TodoMetadataRequest(null, true, "2hr", "critical");
        ResponseEntity<TodoMetadataResponse> response = restTemplate.exchange(
                "/api/neurons/{neuronId}/todo", HttpMethod.PATCH,
                new HttpEntity<>(request), TodoMetadataResponse.class, neuronId);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody().completed()).isTrue();
        assertThat(response.getBody().completedAt()).isNotNull();
        assertThat(response.getBody().effort()).isEqualTo("2hr");
        assertThat(response.getBody().priority()).isEqualTo("critical");
    }

    @Test
    void getClusterTodoMetadata_returnsBatch() {
        // Create a todo cluster with neurons
        ClusterResponse todoCluster = restTemplate.postForEntity("/api/clusters",
                new CreateClusterRequest("Tasks", brainId, "todo", null, null),
                ClusterResponse.class).getBody();

        NeuronResponse todoNeuron = restTemplate.postForEntity("/api/neurons",
                new NeuronRequest("Todo Neuron", brainId, todoCluster.id(), null, null, null, null, null),
                NeuronResponse.class).getBody();

        // Initialize metadata
        restTemplate.getForEntity("/api/neurons/{neuronId}/todo",
                TodoMetadataResponse.class, todoNeuron.id());

        ResponseEntity<Map<String, TodoMetadataResponse>> response = restTemplate.exchange(
                "/api/clusters/{clusterId}/todo", HttpMethod.GET, null,
                new ParameterizedTypeReference<Map<String, TodoMetadataResponse>>() {}, todoCluster.id());

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).isNotNull();
    }

    @Test
    void createTaskFromNeuron_returns201() {
        CreateTaskFromNeuronRequest request = new CreateTaskFromNeuronRequest(neuronId, "New Task");

        ResponseEntity<CreateTaskFromNeuronResponse> response = restTemplate.postForEntity(
                "/api/brains/{brainId}/tasks", request,
                CreateTaskFromNeuronResponse.class, brainId);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().neuron().title()).isEqualTo("New Task");
        assertThat(response.getBody().todoMetadata().priority()).isEqualTo("normal");
    }

    @Test
    void createTaskFromNeuron_autoCreatesTodoCluster() {
        CreateTaskFromNeuronRequest request = new CreateTaskFromNeuronRequest(neuronId, "Auto Todo");

        ResponseEntity<CreateTaskFromNeuronResponse> response = restTemplate.postForEntity(
                "/api/brains/{brainId}/tasks", request,
                CreateTaskFromNeuronResponse.class, brainId);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        assertThat(response.getBody().clusterId()).isNotNull();
    }
}
