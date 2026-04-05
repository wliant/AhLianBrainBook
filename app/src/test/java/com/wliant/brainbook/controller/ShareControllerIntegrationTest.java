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
class ShareControllerIntegrationTest {

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

        BrainResponse brain = restTemplate.postForEntity("/api/brains",
                new BrainRequest("Test Brain", null, null, null), BrainResponse.class).getBody();
        ClusterResponse cluster = restTemplate.postForEntity("/api/clusters",
                new CreateClusterRequest("Test Cluster", brain.id(), null, null, null),
                ClusterResponse.class).getBody();
        NeuronResponse neuron = restTemplate.postForEntity("/api/neurons",
                new NeuronRequest("Test Neuron", brain.id(), cluster.id(), null, null, null, null, null),
                NeuronResponse.class).getBody();
        neuronId = neuron.id();
    }

    @Test
    void createShare_returns201() {
        ResponseEntity<ShareResponse> response = restTemplate.postForEntity(
                "/api/neurons/{neuronId}/share", null, ShareResponse.class, neuronId);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().token()).hasSize(64);
        assertThat(response.getBody().expiresAt()).isNull();
    }

    @Test
    void createShare_withExpiry_returns201() {
        ShareRequest request = new ShareRequest(24);
        ResponseEntity<ShareResponse> response = restTemplate.postForEntity(
                "/api/neurons/{neuronId}/share", request, ShareResponse.class, neuronId);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        assertThat(response.getBody().expiresAt()).isNotNull();
    }

    @Test
    void getSharedNeuron_returns200() {
        ShareResponse share = restTemplate.postForEntity(
                "/api/neurons/{neuronId}/share", null, ShareResponse.class, neuronId).getBody();

        ResponseEntity<SharedNeuronResponse> response = restTemplate.getForEntity(
                "/api/shares/{token}", SharedNeuronResponse.class, share.token());

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().title()).isEqualTo("Test Neuron");
    }

    @Test
    void getSharedNeuron_unknownToken_returns404() {
        ResponseEntity<String> response = restTemplate.getForEntity(
                "/api/shares/{token}", String.class, "nonexistent_token_of_64_chars_padding_padding_padding_padding_pad");

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
    }

    @Test
    void listShares_returns200() {
        restTemplate.postForEntity("/api/neurons/{neuronId}/share", null,
                ShareResponse.class, neuronId);
        restTemplate.postForEntity("/api/neurons/{neuronId}/share", null,
                ShareResponse.class, neuronId);

        ResponseEntity<List<ShareResponse>> response = restTemplate.exchange(
                "/api/neurons/{neuronId}/shares",
                HttpMethod.GET, null,
                new ParameterizedTypeReference<List<ShareResponse>>() {}, neuronId);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).hasSize(2);
    }

    @Test
    void revokeShare_returns204() {
        ShareResponse share = restTemplate.postForEntity(
                "/api/neurons/{neuronId}/share", null, ShareResponse.class, neuronId).getBody();

        ResponseEntity<Void> response = restTemplate.exchange(
                "/api/shares/{shareId}", HttpMethod.DELETE, null, Void.class, share.id());

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);
    }

    @Test
    void revokeShare_unknownId_returns404() {
        ResponseEntity<String> response = restTemplate.exchange(
                "/api/shares/{shareId}", HttpMethod.DELETE, null, String.class, UUID.randomUUID());

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
    }
}
