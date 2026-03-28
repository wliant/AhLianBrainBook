package com.wliant.brainbook.controller;

import com.wliant.brainbook.config.TestContainersConfig;
import com.wliant.brainbook.dto.BrainRequest;
import com.wliant.brainbook.dto.BrainResponse;
import com.wliant.brainbook.dto.ClusterRequest;
import com.wliant.brainbook.dto.ClusterResponse;
import com.wliant.brainbook.repository.AttachmentRepository;
import com.wliant.brainbook.repository.NeuronLinkRepository;
import com.wliant.brainbook.repository.NeuronRepository;
import com.wliant.brainbook.repository.NeuronRevisionRepository;
import com.wliant.brainbook.repository.ClusterRepository;
import com.wliant.brainbook.repository.BrainRepository;
import com.wliant.brainbook.repository.TagRepository;
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
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@Import(TestContainersConfig.class)
@ActiveProfiles("test")
class ClusterControllerIntegrationTest {

    @MockitoBean
    private MinioClient minioClient;

    @Autowired
    private TestRestTemplate restTemplate;

    @Autowired
    private NeuronRevisionRepository neuronRevisionRepository;

    @Autowired
    private AttachmentRepository attachmentRepository;

    @Autowired
    private NeuronLinkRepository neuronLinkRepository;

    @Autowired
    private NeuronRepository neuronRepository;

    @Autowired
    private ClusterRepository clusterRepository;

    @Autowired
    private BrainRepository brainRepository;

    @Autowired
    private TagRepository tagRepository;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @BeforeEach
    void cleanup() {
        jdbcTemplate.execute("DELETE FROM neuron_tags");
        neuronRevisionRepository.deleteAll();
        attachmentRepository.deleteAll();
        neuronLinkRepository.deleteAll();
        neuronRepository.deleteAll();
        clusterRepository.deleteAll();
        brainRepository.deleteAll();
        tagRepository.deleteAll();
    }

    private UUID createBrain(String name) {
        BrainRequest request = new BrainRequest(name, "icon", "#FF0000", null);
        ResponseEntity<BrainResponse> response = restTemplate.postForEntity(
                "/api/brains", request, BrainResponse.class);
        return response.getBody().id();
    }

    @Test
    void createCluster_underBrain() {
        UUID brainId = createBrain("Test Brain");
        ClusterRequest request = new ClusterRequest("My Cluster", brainId, null);

        ResponseEntity<ClusterResponse> response = restTemplate.postForEntity(
                "/api/clusters", request, ClusterResponse.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().name()).isEqualTo("My Cluster");
        assertThat(response.getBody().brainId()).isEqualTo(brainId);
        assertThat(response.getBody().id()).isNotNull();
    }

    @Test
    void getClustersByBrainId_returnsList() {
        UUID brainId = createBrain("Test Brain");
        restTemplate.postForEntity("/api/clusters",
                new ClusterRequest("Cluster 1", brainId, null), ClusterResponse.class);
        restTemplate.postForEntity("/api/clusters",
                new ClusterRequest("Cluster 2", brainId, null), ClusterResponse.class);

        ResponseEntity<List<ClusterResponse>> response = restTemplate.exchange(
                "/api/clusters/brain/{brainId}",
                HttpMethod.GET,
                null,
                new ParameterizedTypeReference<List<ClusterResponse>>() {},
                brainId);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).hasSize(2);
    }

    @Test
    void updateCluster_modifiesName() {
        UUID brainId = createBrain("Test Brain");
        ResponseEntity<ClusterResponse> createResponse = restTemplate.postForEntity(
                "/api/clusters",
                new ClusterRequest("Original", brainId, null),
                ClusterResponse.class);
        UUID clusterId = createResponse.getBody().id();

        ClusterRequest updateRequest = new ClusterRequest("Updated", brainId, null);
        ResponseEntity<ClusterResponse> response = restTemplate.exchange(
                "/api/clusters/{id}",
                HttpMethod.PATCH,
                new HttpEntity<>(updateRequest),
                ClusterResponse.class,
                clusterId);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().name()).isEqualTo("Updated");
    }

    @Test
    void deleteCluster_removes() {
        UUID brainId = createBrain("Test Brain");
        ResponseEntity<ClusterResponse> createResponse = restTemplate.postForEntity(
                "/api/clusters",
                new ClusterRequest("To Delete", brainId, null),
                ClusterResponse.class);
        UUID clusterId = createResponse.getBody().id();

        ResponseEntity<Void> deleteResponse = restTemplate.exchange(
                "/api/clusters/{id}",
                HttpMethod.DELETE,
                null,
                Void.class,
                clusterId);

        assertThat(deleteResponse.getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);

        // Verify cluster is gone by checking the list for this brain
        ResponseEntity<List<ClusterResponse>> listResponse = restTemplate.exchange(
                "/api/clusters/brain/{brainId}",
                HttpMethod.GET,
                null,
                new ParameterizedTypeReference<List<ClusterResponse>>() {},
                brainId);

        assertThat(listResponse.getBody()).isEmpty();
    }
}
