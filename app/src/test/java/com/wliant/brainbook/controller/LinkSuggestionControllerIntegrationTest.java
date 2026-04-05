package com.wliant.brainbook.controller;

import com.wliant.brainbook.config.DatabaseCleaner;
import com.wliant.brainbook.config.TestContainersConfig;
import com.wliant.brainbook.config.TestDataFactory;
import com.wliant.brainbook.config.TestDataFactory.BrainClusterNeuron;
import com.wliant.brainbook.dto.LinkSuggestionResponse;
import io.minio.MinioClient;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.context.annotation.Import;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@Import(TestContainersConfig.class)
@ActiveProfiles("test")
class LinkSuggestionControllerIntegrationTest {

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
    void getSuggestions_returns200() {
        ResponseEntity<List<LinkSuggestionResponse>> response = restTemplate.exchange(
                "/api/link-suggestions/neuron/{neuronId}",
                HttpMethod.GET, null,
                new ParameterizedTypeReference<List<LinkSuggestionResponse>>() {},
                chain.neuron().id());

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody()).isEmpty();
    }

    @Test
    void getSuggestions_unknownNeuron_returns404() {
        ResponseEntity<String> response = restTemplate.getForEntity(
                "/api/link-suggestions/neuron/{neuronId}", String.class, UUID.randomUUID());

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
    }

    @Test
    void acceptSuggestion_unknown_returns404() {
        ResponseEntity<String> response = restTemplate.postForEntity(
                "/api/link-suggestions/{id}/accept", null, String.class, UUID.randomUUID());

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
    }
}
