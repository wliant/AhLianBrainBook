package com.wliant.brainbook.controller;

import com.wliant.brainbook.config.DatabaseCleaner;
import com.wliant.brainbook.config.TestContainersConfig;
import com.wliant.brainbook.dto.BrainRequest;
import com.wliant.brainbook.dto.BrainResponse;
import com.wliant.brainbook.dto.CreateClusterRequest;
import com.wliant.brainbook.dto.UpdateClusterRequest;
import com.wliant.brainbook.dto.ClusterResponse;
import com.wliant.brainbook.dto.ReorderRequest;
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

import java.util.List;
import java.util.Map;
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
    private DatabaseCleaner databaseCleaner;

    @BeforeEach
    void cleanup() {
        databaseCleaner.clean();
    }

    private UUID createBrain(String name) {
        BrainRequest request = new BrainRequest(name, "icon", "#FF0000", null);
        ResponseEntity<BrainResponse> response = restTemplate.postForEntity(
                "/api/brains", request, BrainResponse.class);
        return response.getBody().id();
    }

    @Test
    void createCluster_defaultsToKnowledge() {
        UUID brainId = createBrain("Test Brain");

        ResponseEntity<ClusterResponse> response = restTemplate.postForEntity(
                "/api/clusters", new CreateClusterRequest("My Cluster", brainId, null), ClusterResponse.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        assertThat(response.getBody().name()).isEqualTo("My Cluster");
        assertThat(response.getBody().type()).isEqualTo("knowledge");
        assertThat(response.getBody().brainId()).isEqualTo(brainId);
    }

    @Test
    void createAiResearchCluster_returnsCreated() {
        UUID brainId = createBrain("Test Brain");

        ResponseEntity<ClusterResponse> response = restTemplate.postForEntity(
                "/api/clusters", new CreateClusterRequest("Research", brainId, "ai-research"), ClusterResponse.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        assertThat(response.getBody().type()).isEqualTo("ai-research");
    }

    @Test
    void createSecondAiResearchCluster_returns409() {
        UUID brainId = createBrain("Test Brain");
        restTemplate.postForEntity("/api/clusters",
                new CreateClusterRequest("Research 1", brainId, "ai-research"), ClusterResponse.class);

        ResponseEntity<String> response = restTemplate.postForEntity(
                "/api/clusters",
                new CreateClusterRequest("Research 2", brainId, "ai-research"),
                String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
    }

    @Test
    void getClustersByBrainId_returnsList() {
        UUID brainId = createBrain("Test Brain");
        restTemplate.postForEntity("/api/clusters",
                new CreateClusterRequest("Cluster 1", brainId, null), ClusterResponse.class);
        restTemplate.postForEntity("/api/clusters",
                new CreateClusterRequest("Cluster 2", brainId, null), ClusterResponse.class);

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
    void updateCluster_modifiesNameOnly() {
        UUID brainId = createBrain("Test Brain");
        ClusterResponse created = restTemplate.postForEntity(
                "/api/clusters",
                new CreateClusterRequest("Original", brainId, null),
                ClusterResponse.class).getBody();

        ResponseEntity<ClusterResponse> response = restTemplate.exchange(
                "/api/clusters/{id}",
                HttpMethod.PATCH,
                new HttpEntity<>(new UpdateClusterRequest("Updated")),
                ClusterResponse.class,
                created.id());

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody().name()).isEqualTo("Updated");
        assertThat(response.getBody().type()).isEqualTo("knowledge");
    }

    @Test
    void deleteCluster_removes() {
        UUID brainId = createBrain("Test Brain");
        ClusterResponse created = restTemplate.postForEntity(
                "/api/clusters",
                new CreateClusterRequest("To Delete", brainId, null),
                ClusterResponse.class).getBody();

        ResponseEntity<Void> deleteResponse = restTemplate.exchange(
                "/api/clusters/{id}", HttpMethod.DELETE, null, Void.class, created.id());

        assertThat(deleteResponse.getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);

        ResponseEntity<List<ClusterResponse>> listResponse = restTemplate.exchange(
                "/api/clusters/brain/{brainId}", HttpMethod.GET, null,
                new ParameterizedTypeReference<List<ClusterResponse>>() {}, brainId);

        assertThat(listResponse.getBody()).isEmpty();
    }

    @Test
    void getCluster_returnsCluster() {
        UUID brainId = createBrain("Test Brain");
        ClusterResponse created = restTemplate.postForEntity(
                "/api/clusters",
                new CreateClusterRequest("My Cluster", brainId, null),
                ClusterResponse.class).getBody();

        ResponseEntity<ClusterResponse> response = restTemplate.getForEntity(
                "/api/clusters/{id}", ClusterResponse.class, created.id());

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody().name()).isEqualTo("My Cluster");
    }

    @Test
    void archiveCluster_setsArchived() {
        UUID brainId = createBrain("Test Brain");
        ClusterResponse created = restTemplate.postForEntity(
                "/api/clusters",
                new CreateClusterRequest("To Archive", brainId, null),
                ClusterResponse.class).getBody();

        ResponseEntity<ClusterResponse> response = restTemplate.postForEntity(
                "/api/clusters/{id}/archive", null, ClusterResponse.class, created.id());

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody().isArchived()).isTrue();
    }

    @Test
    void restoreCluster_unsetsArchived() {
        UUID brainId = createBrain("Test Brain");
        ClusterResponse created = restTemplate.postForEntity(
                "/api/clusters",
                new CreateClusterRequest("To Restore", brainId, null),
                ClusterResponse.class).getBody();
        restTemplate.postForEntity("/api/clusters/{id}/archive", null, ClusterResponse.class, created.id());

        ResponseEntity<ClusterResponse> response = restTemplate.postForEntity(
                "/api/clusters/{id}/restore", null, ClusterResponse.class, created.id());

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody().isArchived()).isFalse();
    }

    @Test
    void reorderClusters_returns200() {
        UUID brainId = createBrain("Test Brain");
        ClusterResponse c1 = restTemplate.postForEntity(
                "/api/clusters", new CreateClusterRequest("A", brainId, null), ClusterResponse.class).getBody();
        ClusterResponse c2 = restTemplate.postForEntity(
                "/api/clusters", new CreateClusterRequest("B", brainId, null), ClusterResponse.class).getBody();

        ReorderRequest req = new ReorderRequest(List.of(c2.id(), c1.id()));
        ResponseEntity<Void> response = restTemplate.postForEntity(
                "/api/clusters/reorder", req, Void.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
    }

    @Test
    void moveCluster_changesBrain() {
        UUID brainId = createBrain("Brain 1");
        UUID brain2Id = createBrain("Brain 2");
        ClusterResponse created = restTemplate.postForEntity(
                "/api/clusters",
                new CreateClusterRequest("To Move", brainId, null),
                ClusterResponse.class).getBody();

        ResponseEntity<ClusterResponse> response = restTemplate.postForEntity(
                "/api/clusters/{id}/move",
                Map.of("brainId", brain2Id),
                ClusterResponse.class,
                created.id());

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody().brainId()).isEqualTo(brain2Id);
    }
}
