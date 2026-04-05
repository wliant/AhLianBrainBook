package com.wliant.brainbook.controller;

import com.wliant.brainbook.config.DatabaseCleaner;
import com.wliant.brainbook.config.TestContainersConfig;
import com.wliant.brainbook.config.TestDataFactory;
import com.wliant.brainbook.config.TestDataFactory.BrainClusterNeuron;
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

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@Import(TestContainersConfig.class)
@ActiveProfiles("test")
class ExportControllerIntegrationTest {

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
    void exportNeuronMarkdown_returns200() {
        ResponseEntity<String> response = restTemplate.getForEntity(
                "/api/neurons/{id}/export/markdown", String.class, chain.neuron().id());

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getHeaders().getContentType().toString()).contains("text/markdown");
        assertThat(response.getBody()).contains(chain.neuron().title());
    }

    @Test
    void exportNeuronMarkdown_notFound_returns404() {
        ResponseEntity<String> response = restTemplate.getForEntity(
                "/api/neurons/{id}/export/markdown", String.class, UUID.randomUUID());

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
    }

    @Test
    void exportBrainMarkdown_returns200_zip() {
        ResponseEntity<byte[]> response = restTemplate.getForEntity(
                "/api/brains/{id}/export/markdown", byte[].class, chain.brain().id());

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().length).isGreaterThan(0);
        // ZIP magic bytes: PK (0x50, 0x4B)
        assertThat(response.getBody()[0]).isEqualTo((byte) 0x50);
        assertThat(response.getBody()[1]).isEqualTo((byte) 0x4B);
    }

    @Test
    void exportBrainMarkdown_notFound_returns404() {
        ResponseEntity<String> response = restTemplate.getForEntity(
                "/api/brains/{id}/export/markdown", String.class, UUID.randomUUID());

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
    }
}
