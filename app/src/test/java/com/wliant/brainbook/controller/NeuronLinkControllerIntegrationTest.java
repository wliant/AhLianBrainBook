package com.wliant.brainbook.controller;

import com.wliant.brainbook.config.DatabaseCleaner;
import com.wliant.brainbook.config.TestContainersConfig;
import com.wliant.brainbook.dto.BrainRequest;
import com.wliant.brainbook.dto.BrainResponse;
import com.wliant.brainbook.dto.CreateClusterRequest;
import com.wliant.brainbook.dto.ClusterResponse;
import com.wliant.brainbook.dto.NeuronLinkRequest;
import com.wliant.brainbook.dto.NeuronLinkResponse;
import com.wliant.brainbook.dto.NeuronRequest;
import com.wliant.brainbook.dto.NeuronResponse;
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
class NeuronLinkControllerIntegrationTest {

    @MockitoBean
    private MinioClient minioClient;

    @Autowired
    private TestRestTemplate restTemplate;

    @Autowired
    private DatabaseCleaner databaseCleaner;

    private UUID brainId;
    private UUID neuronId1;
    private UUID neuronId2;

    @BeforeEach
    void cleanup() {
        databaseCleaner.clean();

        BrainRequest brainReq = new BrainRequest("Test Brain", "icon", "#FF0000", null);
        ResponseEntity<BrainResponse> brainResp = restTemplate.postForEntity(
                "/api/brains", brainReq, BrainResponse.class);
        brainId = brainResp.getBody().id();

        CreateClusterRequest clusterReq = new CreateClusterRequest("Test Cluster", brainId, null);
        ResponseEntity<ClusterResponse> clusterResp = restTemplate.postForEntity(
                "/api/clusters", clusterReq, ClusterResponse.class);
        UUID clusterId = clusterResp.getBody().id();

        NeuronRequest n1Req = new NeuronRequest("Neuron 1", brainId, clusterId, "{}", "", null, null);
        neuronId1 = restTemplate.postForEntity("/api/neurons", n1Req, NeuronResponse.class).getBody().id();

        NeuronRequest n2Req = new NeuronRequest("Neuron 2", brainId, clusterId, "{}", "", null, null);
        neuronId2 = restTemplate.postForEntity("/api/neurons", n2Req, NeuronResponse.class).getBody().id();
    }

    @Test
    void createLink_returns201() {
        NeuronLinkRequest req = new NeuronLinkRequest(neuronId1, neuronId2, "related", "ref", 1.0, null);

        ResponseEntity<NeuronLinkResponse> response = restTemplate.postForEntity(
                "/api/neuron-links", req, NeuronLinkResponse.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().sourceNeuronId()).isEqualTo(neuronId1);
        assertThat(response.getBody().targetNeuronId()).isEqualTo(neuronId2);
    }

    @Test
    void createLink_selfLink_returns409() {
        NeuronLinkRequest req = new NeuronLinkRequest(neuronId1, neuronId1, "self", "ref", null, null);

        ResponseEntity<String> response = restTemplate.postForEntity(
                "/api/neuron-links", req, String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
    }

    @Test
    void createLink_duplicateLink_returns409() {
        NeuronLinkRequest req = new NeuronLinkRequest(neuronId1, neuronId2, "link", "ref", null, null);
        restTemplate.postForEntity("/api/neuron-links", req, NeuronLinkResponse.class);

        ResponseEntity<String> response = restTemplate.postForEntity(
                "/api/neuron-links", req, String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
    }

    @Test
    void getLinksForNeuron_returnsList() {
        NeuronLinkRequest req = new NeuronLinkRequest(neuronId1, neuronId2, "link", "ref", null, null);
        restTemplate.postForEntity("/api/neuron-links", req, NeuronLinkResponse.class);

        ResponseEntity<List<NeuronLinkResponse>> response = restTemplate.exchange(
                "/api/neuron-links/neuron/{neuronId}",
                HttpMethod.GET,
                null,
                new ParameterizedTypeReference<List<NeuronLinkResponse>>() {},
                neuronId1);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).hasSize(1);
    }

    @Test
    void getLinksForBrain_returnsList() {
        NeuronLinkRequest req = new NeuronLinkRequest(neuronId1, neuronId2, "link", "ref", null, null);
        restTemplate.postForEntity("/api/neuron-links", req, NeuronLinkResponse.class);

        ResponseEntity<List<NeuronLinkResponse>> response = restTemplate.exchange(
                "/api/neuron-links/brain/{brainId}",
                HttpMethod.GET,
                null,
                new ParameterizedTypeReference<List<NeuronLinkResponse>>() {},
                brainId);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).hasSize(1);
    }

    @Test
    void deleteLink_returns204() {
        NeuronLinkRequest req = new NeuronLinkRequest(neuronId1, neuronId2, "link", "ref", null, null);
        NeuronLinkResponse created = restTemplate.postForEntity(
                "/api/neuron-links", req, NeuronLinkResponse.class).getBody();

        ResponseEntity<Void> response = restTemplate.exchange(
                "/api/neuron-links/{id}",
                HttpMethod.DELETE,
                null,
                Void.class,
                created.id());

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);
    }

    @Test
    void getLinksForNeuron_returns404_forNonexistentNeuron() {
        ResponseEntity<String> response = restTemplate.exchange(
                "/api/neuron-links/neuron/{neuronId}",
                HttpMethod.GET,
                null,
                String.class,
                UUID.randomUUID());

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
    }
}
