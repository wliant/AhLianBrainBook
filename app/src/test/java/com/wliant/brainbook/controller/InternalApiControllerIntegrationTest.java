package com.wliant.brainbook.controller;

import com.wliant.brainbook.config.DatabaseCleaner;
import com.wliant.brainbook.config.TestContainersConfig;
import com.wliant.brainbook.config.TestDataFactory;
import com.wliant.brainbook.dto.BrainResponse;
import com.wliant.brainbook.dto.ClusterResponse;
import com.wliant.brainbook.dto.NeuronContentRequest;
import com.wliant.brainbook.dto.NeuronResponse;
import com.wliant.brainbook.service.NeuronService;
import io.minio.MinioClient;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@Import(TestContainersConfig.class)
@ActiveProfiles("test")
class InternalApiControllerIntegrationTest {

    @MockitoBean
    private MinioClient minioClient;

    @Autowired
    private TestRestTemplate restTemplate;

    @Autowired
    private NeuronService neuronService;

    @Autowired
    private DatabaseCleaner databaseCleaner;

    @Autowired
    private TestDataFactory testDataFactory;

    private BrainResponse brain;
    private NeuronResponse neuron;

    @BeforeEach
    void setUp() {
        databaseCleaner.clean();
        brain = testDataFactory.createBrain("Internal API Test Brain");
        ClusterResponse cluster = testDataFactory.createCluster("Test Cluster", brain.id());
        neuron = testDataFactory.createNeuron("Test Neuron", brain.id(), cluster.id());
        neuronService.updateContent(neuron.id(),
                new NeuronContentRequest(
                        "{\"version\":2,\"sections\":[{\"id\":\"s1\",\"type\":\"rich-text\",\"order\":0,\"content\":{\"type\":\"doc\",\"content\":[{\"type\":\"paragraph\",\"content\":[{\"type\":\"text\",\"text\":\"Hello world test content\"}]}]}}]}",
                        "Hello world test content",
                        neuron.version()));
    }

    @Test
    @SuppressWarnings("unchecked")
    void search_returns200WithResults() throws Exception {
        // Wait for content to be indexed
        Thread.sleep(1000);

        ResponseEntity<List> response = restTemplate.getForEntity(
                "/api/internal/search?q=Hello&brainId=" + brain.id() + "&size=5",
                List.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).isNotNull();
    }

    @Test
    @SuppressWarnings("unchecked")
    void neuronContent_returns200() {
        ResponseEntity<Map> response = restTemplate.getForEntity(
                "/api/internal/neurons/" + neuron.id() + "/content",
                Map.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().get("title")).isEqualTo("Test Neuron");
        assertThat((String) response.getBody().get("contentText")).contains("Hello world");
    }

    @Test
    void neuronContent_returns404ForMissing() {
        ResponseEntity<String> response = restTemplate.getForEntity(
                "/api/internal/neurons/" + UUID.randomUUID() + "/content",
                String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
    }
}
