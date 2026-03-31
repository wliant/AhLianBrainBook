package com.wliant.brainbook.controller;

import com.wliant.brainbook.config.DatabaseCleaner;
import com.wliant.brainbook.config.TestContainersConfig;
import com.wliant.brainbook.config.TestDataFactory;
import com.wliant.brainbook.dto.BrainResponse;
import com.wliant.brainbook.dto.ClusterResponse;
import com.wliant.brainbook.dto.NeuronResponse;
import io.minio.MinioClient;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@Import(TestContainersConfig.class)
@ActiveProfiles("test")
class HttpCacheIntegrationTest {

    @MockitoBean
    private MinioClient minioClient;

    @Autowired
    private TestRestTemplate restTemplate;

    @Autowired
    private DatabaseCleaner databaseCleaner;

    @Autowired
    private TestDataFactory testDataFactory;

    @BeforeEach
    void cleanup() {
        databaseCleaner.clean();
    }

    @Test
    void brainsEndpoint_hasCacheControlHeader() {
        ResponseEntity<String> response = restTemplate.getForEntity("/api/brains", String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getHeaders().getCacheControl()).contains("max-age=60");
        assertThat(response.getHeaders().getCacheControl()).contains("private");
    }

    @Test
    void tagsEndpoint_hasCacheControlHeader() {
        ResponseEntity<String> response = restTemplate.getForEntity("/api/tags", String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getHeaders().getCacheControl()).contains("max-age=60");
        assertThat(response.getHeaders().getCacheControl()).contains("private");
    }

    @Test
    void settingsEndpoint_hasCacheControlHeader() {
        ResponseEntity<String> response = restTemplate.getForEntity("/api/settings", String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getHeaders().getCacheControl()).contains("max-age=300");
        assertThat(response.getHeaders().getCacheControl()).contains("private");
    }

    @Test
    void postRequest_hasNoStoreHeader() {
        HttpHeaders headers = new HttpHeaders();
        headers.set("Content-Type", "application/json");

        ResponseEntity<String> response = restTemplate.exchange(
                "/api/brains",
                HttpMethod.POST,
                new HttpEntity<>("{\"name\":\"Test Brain\",\"icon\":\"🧠\",\"color\":\"#FF0000\"}", headers),
                String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        assertThat(response.getHeaders().getCacheControl()).contains("no-store");
    }

    @Test
    void neuronEndpoint_returnsETag() {
        BrainResponse brain = testDataFactory.createBrain();
        ClusterResponse cluster = testDataFactory.createCluster(brain.id());
        NeuronResponse neuron = testDataFactory.createNeuron(brain.id(), cluster.id());

        ResponseEntity<String> response = restTemplate.getForEntity(
                "/api/neurons/" + neuron.id(), String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getHeaders().getETag()).isNotNull();
        assertThat(response.getHeaders().getETag()).contains(String.valueOf(neuron.version()));
    }

    @Test
    void neuronEndpoint_returns304_whenETagMatches() {
        BrainResponse brain = testDataFactory.createBrain();
        ClusterResponse cluster = testDataFactory.createCluster(brain.id());
        NeuronResponse neuron = testDataFactory.createNeuron(brain.id(), cluster.id());

        // First request to get the ETag
        ResponseEntity<String> first = restTemplate.getForEntity(
                "/api/neurons/" + neuron.id(), String.class);
        String etag = first.getHeaders().getETag();
        assertThat(etag).isNotNull();

        // Second request with If-None-Match
        HttpHeaders headers = new HttpHeaders();
        headers.set("If-None-Match", etag);

        ResponseEntity<String> second = restTemplate.exchange(
                "/api/neurons/" + neuron.id(),
                HttpMethod.GET,
                new HttpEntity<>(headers),
                String.class);

        assertThat(second.getStatusCode()).isEqualTo(HttpStatus.NOT_MODIFIED);
    }
}
