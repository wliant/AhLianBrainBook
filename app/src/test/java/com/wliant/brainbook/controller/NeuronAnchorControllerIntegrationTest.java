package com.wliant.brainbook.controller;

import com.wliant.brainbook.config.DatabaseCleaner;
import com.wliant.brainbook.config.TestContainersConfig;
import com.wliant.brainbook.config.TestDataFactory;
import com.wliant.brainbook.config.TestDataFactory.BrainClusterNeuron;
import com.wliant.brainbook.dto.CreateNeuronAnchorRequest;
import com.wliant.brainbook.dto.NeuronAnchorResponse;
import com.wliant.brainbook.dto.NeuronResponse;
import com.wliant.brainbook.dto.UpdateNeuronAnchorRequest;
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

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@Import(TestContainersConfig.class)
@ActiveProfiles("test")
class NeuronAnchorControllerIntegrationTest {

    @MockitoBean
    private MinioClient minioClient;

    @Autowired
    private TestRestTemplate restTemplate;

    @Autowired
    private DatabaseCleaner databaseCleaner;

    @Autowired
    private TestDataFactory testDataFactory;

    private BrainClusterNeuron chain;

    @BeforeEach
    void setUp() {
        databaseCleaner.clean();
        chain = testDataFactory.createFullChain();
    }

    @Test
    void createAnchor_returns201() {
        CreateNeuronAnchorRequest req = new CreateNeuronAnchorRequest(
                chain.neuron().id(), chain.cluster().id(), "src/Main.java");

        ResponseEntity<NeuronAnchorResponse> response = restTemplate.postForEntity(
                "/api/neuron-anchors", req, NeuronAnchorResponse.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().filePath()).isEqualTo("src/Main.java");
        assertThat(response.getBody().neuronId()).isEqualTo(chain.neuron().id());
    }

    @Test
    void createAnchor_duplicateNeuron_returns409() {
        CreateNeuronAnchorRequest req = new CreateNeuronAnchorRequest(
                chain.neuron().id(), chain.cluster().id(), "src/Main.java");
        restTemplate.postForEntity("/api/neuron-anchors", req, NeuronAnchorResponse.class);

        CreateNeuronAnchorRequest dup = new CreateNeuronAnchorRequest(
                chain.neuron().id(), chain.cluster().id(), "src/Other.java");
        ResponseEntity<String> response = restTemplate.postForEntity(
                "/api/neuron-anchors", dup, String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
    }

    @Test
    void listByCluster_returns200() {
        CreateNeuronAnchorRequest req = new CreateNeuronAnchorRequest(
                chain.neuron().id(), chain.cluster().id(), "src/Main.java");
        restTemplate.postForEntity("/api/neuron-anchors", req, NeuronAnchorResponse.class);

        ResponseEntity<String> response = restTemplate.getForEntity(
                "/api/neuron-anchors/cluster/{clusterId}", String.class, chain.cluster().id());

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).contains("src/Main.java");
    }

    @Test
    void listByFile_returns200() {
        CreateNeuronAnchorRequest req = new CreateNeuronAnchorRequest(
                chain.neuron().id(), chain.cluster().id(), "src/Main.java");
        restTemplate.postForEntity("/api/neuron-anchors", req, NeuronAnchorResponse.class);

        ResponseEntity<String> response = restTemplate.getForEntity(
                "/api/neuron-anchors/cluster/{clusterId}/file?path=src/Main.java",
                String.class, chain.cluster().id());

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).contains("src/Main.java");
    }

    @Test
    void updateAnchor_returns200() {
        CreateNeuronAnchorRequest req = new CreateNeuronAnchorRequest(
                chain.neuron().id(), chain.cluster().id(), "src/Main.java");
        NeuronAnchorResponse created = restTemplate.postForEntity(
                "/api/neuron-anchors", req, NeuronAnchorResponse.class).getBody();

        UpdateNeuronAnchorRequest update = new UpdateNeuronAnchorRequest("src/NewMain.java");
        ResponseEntity<NeuronAnchorResponse> response = restTemplate.exchange(
                "/api/neuron-anchors/{id}", HttpMethod.PATCH,
                new HttpEntity<>(update), NeuronAnchorResponse.class, created.id());

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody().filePath()).isEqualTo("src/NewMain.java");
    }

    @Test
    void deleteAnchor_returns204() {
        CreateNeuronAnchorRequest req = new CreateNeuronAnchorRequest(
                chain.neuron().id(), chain.cluster().id(), "src/Main.java");
        NeuronAnchorResponse created = restTemplate.postForEntity(
                "/api/neuron-anchors", req, NeuronAnchorResponse.class).getBody();

        ResponseEntity<Void> response = restTemplate.exchange(
                "/api/neuron-anchors/{id}", HttpMethod.DELETE, null, Void.class, created.id());

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);
    }

    @Test
    void deleteAnchor_unknown_returns404() {
        ResponseEntity<String> response = restTemplate.exchange(
                "/api/neuron-anchors/{id}", HttpMethod.DELETE, null, String.class, UUID.randomUUID());

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
    }
}
