package com.wliant.brainbook.controller;

import com.wliant.brainbook.config.DatabaseCleaner;
import com.wliant.brainbook.config.TestContainersConfig;
import com.wliant.brainbook.dto.BrainRequest;
import com.wliant.brainbook.dto.BrainResponse;
import com.wliant.brainbook.dto.CreateClusterRequest;
import com.wliant.brainbook.dto.ClusterResponse;
import com.wliant.brainbook.dto.MoveNeuronRequest;
import com.wliant.brainbook.dto.NeuronContentRequest;
import com.wliant.brainbook.dto.NeuronRequest;
import com.wliant.brainbook.dto.NeuronResponse;
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
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@Import(TestContainersConfig.class)
@ActiveProfiles("test")
class NeuronControllerIntegrationTest {

    @MockitoBean
    private MinioClient minioClient;

    @Autowired
    private TestRestTemplate restTemplate;

    @Autowired
    private DatabaseCleaner databaseCleaner;

    private UUID brainId;
    private UUID clusterId;

    @BeforeEach
    void cleanup() {
        databaseCleaner.clean();

        // Create brain and cluster for neuron tests
        BrainRequest brainRequest = new BrainRequest("Test Brain", "icon", "#FF0000", null);
        ResponseEntity<BrainResponse> brainResponse = restTemplate.postForEntity(
                "/api/brains", brainRequest, BrainResponse.class);
        brainId = brainResponse.getBody().id();

        CreateClusterRequest clusterRequest = new CreateClusterRequest("Test Cluster", brainId, null, null, null);
        ResponseEntity<ClusterResponse> clusterResponse = restTemplate.postForEntity(
                "/api/clusters", clusterRequest, ClusterResponse.class);
        clusterId = clusterResponse.getBody().id();
    }

    private NeuronResponse createNeuron(String title) {
        NeuronRequest request = new NeuronRequest(title, brainId, clusterId, "{}", "", null, null, null);
        ResponseEntity<NeuronResponse> response = restTemplate.postForEntity(
                "/api/neurons", request, NeuronResponse.class);
        return response.getBody();
    }

    @Test
    void createNeuron_succeeds() {
        NeuronRequest request = new NeuronRequest("My Note", brainId, clusterId,
                "{\"type\":\"doc\"}", "plain text", null, null, null);

        ResponseEntity<NeuronResponse> response = restTemplate.postForEntity(
                "/api/neurons", request, NeuronResponse.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().title()).isEqualTo("My Note");
        assertThat(response.getBody().brainId()).isEqualTo(brainId);
        assertThat(response.getBody().clusterId()).isEqualTo(clusterId);
        assertThat(response.getBody().id()).isNotNull();
        assertThat(response.getBody().version()).isEqualTo(1);
    }

    @Test
    void getNeuronsByClusterId_returnsList() {
        createNeuron("Note 1");
        createNeuron("Note 2");

        ResponseEntity<List<NeuronResponse>> response = restTemplate.exchange(
                "/api/neurons/cluster/{clusterId}",
                HttpMethod.GET,
                null,
                new ParameterizedTypeReference<List<NeuronResponse>>() {},
                clusterId);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).hasSize(2);
    }

    @Test
    void getNeuronById_returnsNeuron() {
        NeuronResponse created = createNeuron("Test Note");

        ResponseEntity<NeuronResponse> response = restTemplate.getForEntity(
                "/api/neurons/{id}", NeuronResponse.class, created.id());

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().title()).isEqualTo("Test Note");
        assertThat(response.getBody().id()).isEqualTo(created.id());
    }

    @Test
    void updateNeuronContent_incrementsVersion() {
        NeuronResponse created = createNeuron("Note");
        int initialVersion = created.version();

        NeuronContentRequest contentRequest = new NeuronContentRequest(
                "{\"type\":\"doc\",\"content\":\"updated\"}", "updated content", initialVersion);

        ResponseEntity<NeuronResponse> response = restTemplate.exchange(
                "/api/neurons/{id}/content",
                HttpMethod.PUT,
                new HttpEntity<>(contentRequest),
                NeuronResponse.class,
                created.id());

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().version()).isEqualTo(initialVersion + 1);
        assertThat(response.getBody().contentJson()).isEqualTo("{\"type\":\"doc\",\"content\":\"updated\"}");
    }

    @Test
    void updateNeuronContent_returns409OnVersionConflict() {
        NeuronResponse created = createNeuron("Note");

        // First update with correct version
        NeuronContentRequest firstUpdate = new NeuronContentRequest(
                "{\"v1\":true}", "v1", created.version());
        restTemplate.exchange(
                "/api/neurons/{id}/content",
                HttpMethod.PUT,
                new HttpEntity<>(firstUpdate),
                NeuronResponse.class,
                created.id());

        // Second update with stale version (should conflict)
        NeuronContentRequest staleUpdate = new NeuronContentRequest(
                "{\"v2\":true}", "v2", created.version());
        ResponseEntity<String> response = restTemplate.exchange(
                "/api/neurons/{id}/content",
                HttpMethod.PUT,
                new HttpEntity<>(staleUpdate),
                String.class,
                created.id());

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
    }

    @Test
    void deleteNeuron_softDeletes() {
        NeuronResponse created = createNeuron("To Delete");

        ResponseEntity<Void> deleteResponse = restTemplate.exchange(
                "/api/neurons/{id}",
                HttpMethod.DELETE,
                null,
                Void.class,
                created.id());

        assertThat(deleteResponse.getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);

        // The neuron should still exist but be marked as deleted
        // It should not appear in cluster listing
        ResponseEntity<List<NeuronResponse>> listResponse = restTemplate.exchange(
                "/api/neurons/cluster/{clusterId}",
                HttpMethod.GET,
                null,
                new ParameterizedTypeReference<List<NeuronResponse>>() {},
                clusterId);

        assertThat(listResponse.getBody()).isEmpty();
    }

    @Test
    void toggleFavorite_togglesFlag() {
        NeuronResponse created = createNeuron("Favorite Note");
        assertThat(created.isFavorite()).isFalse();

        // Toggle on
        ResponseEntity<NeuronResponse> response = restTemplate.postForEntity(
                "/api/neurons/{id}/favorite", null, NeuronResponse.class, created.id());

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody().isFavorite()).isTrue();

        // Toggle off
        ResponseEntity<NeuronResponse> response2 = restTemplate.postForEntity(
                "/api/neurons/{id}/favorite", null, NeuronResponse.class, created.id());

        assertThat(response2.getBody().isFavorite()).isFalse();
    }

    @Test
    void getTrash_returnsDeletedNeurons() {
        NeuronResponse created = createNeuron("Trash Note");

        // Delete it (soft delete)
        restTemplate.exchange("/api/neurons/{id}", HttpMethod.DELETE, null, Void.class, created.id());

        ResponseEntity<List<NeuronResponse>> response = restTemplate.exchange(
                "/api/neurons/trash",
                HttpMethod.GET,
                null,
                new ParameterizedTypeReference<List<NeuronResponse>>() {});

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).isNotEmpty();
        assertThat(response.getBody()).anyMatch(n -> n.id().equals(created.id()));
    }

    @Test
    void restoreFromTrash_restoresNeuron() {
        NeuronResponse created = createNeuron("Restore Note");

        // Soft delete
        restTemplate.exchange("/api/neurons/{id}", HttpMethod.DELETE, null, Void.class, created.id());

        // Restore
        ResponseEntity<NeuronResponse> restoreResponse = restTemplate.postForEntity(
                "/api/neurons/{id}/restore-from-trash", null, NeuronResponse.class, created.id());

        assertThat(restoreResponse.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(restoreResponse.getBody().isDeleted()).isFalse();

        // Should appear in cluster listing again
        ResponseEntity<List<NeuronResponse>> listResponse = restTemplate.exchange(
                "/api/neurons/cluster/{clusterId}",
                HttpMethod.GET,
                null,
                new ParameterizedTypeReference<List<NeuronResponse>>() {},
                clusterId);

        assertThat(listResponse.getBody()).anyMatch(n -> n.id().equals(created.id()));
    }

    @Test
    void updateNeuron_modifiesFields() {
        NeuronResponse created = createNeuron("Original");

        NeuronRequest updateReq = new NeuronRequest("Updated", null, null, null, null, null, "moderate", null);
        ResponseEntity<NeuronResponse> response = restTemplate.exchange(
                "/api/neurons/{id}",
                HttpMethod.PATCH,
                new HttpEntity<>(updateReq),
                NeuronResponse.class,
                created.id());

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody().title()).isEqualTo("Updated");
    }

    @Test
    void archiveNeuron_setsArchived() {
        NeuronResponse created = createNeuron("To Archive");

        ResponseEntity<NeuronResponse> response = restTemplate.postForEntity(
                "/api/neurons/{id}/archive", null, NeuronResponse.class, created.id());

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody().isArchived()).isTrue();
    }

    @Test
    void restoreNeuron_unsetsArchived() {
        NeuronResponse created = createNeuron("To Restore");
        restTemplate.postForEntity("/api/neurons/{id}/archive", null, NeuronResponse.class, created.id());

        ResponseEntity<NeuronResponse> response = restTemplate.postForEntity(
                "/api/neurons/{id}/restore", null, NeuronResponse.class, created.id());

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody().isArchived()).isFalse();
    }

    @Test
    void moveNeuron_changesCluster() {
        NeuronResponse created = createNeuron("To Move");

        BrainRequest brain2Req = new BrainRequest("Brain 2", "icon", "#00FF00", null);
        UUID brain2Id = restTemplate.postForEntity("/api/brains", brain2Req, BrainResponse.class).getBody().id();
        CreateClusterRequest cluster2Req = new CreateClusterRequest("Cluster 2", brain2Id, null, null, null);
        UUID cluster2Id = restTemplate.postForEntity("/api/clusters", cluster2Req, ClusterResponse.class).getBody().id();

        MoveNeuronRequest moveReq = new MoveNeuronRequest(cluster2Id, brain2Id);
        ResponseEntity<NeuronResponse> response = restTemplate.postForEntity(
                "/api/neurons/{id}/move", moveReq, NeuronResponse.class, created.id());

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody().brainId()).isEqualTo(brain2Id);
        assertThat(response.getBody().clusterId()).isEqualTo(cluster2Id);
    }

    @Test
    void duplicateNeuron_returns201() {
        NeuronResponse created = createNeuron("Original Note");

        ResponseEntity<NeuronResponse> response = restTemplate.postForEntity(
                "/api/neurons/{id}/duplicate", null, NeuronResponse.class, created.id());

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        assertThat(response.getBody().title()).isEqualTo("Original Note (copy)");
        assertThat(response.getBody().id()).isNotEqualTo(created.id());
    }

    @Test
    void togglePin_togglesFlag() {
        NeuronResponse created = createNeuron("Pin Note");

        ResponseEntity<NeuronResponse> response = restTemplate.postForEntity(
                "/api/neurons/{id}/pin", null, NeuronResponse.class, created.id());

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody().isPinned()).isTrue();
    }

    @Test
    void reorderNeurons_returns200() {
        NeuronResponse n1 = createNeuron("A");
        NeuronResponse n2 = createNeuron("B");

        ReorderRequest req = new ReorderRequest(List.of(n2.id(), n1.id()));
        ResponseEntity<Void> response = restTemplate.postForEntity(
                "/api/neurons/reorder", req, Void.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
    }

    @Test
    void permanentDelete_returns204() {
        NeuronResponse created = createNeuron("To Destroy");

        ResponseEntity<Void> response = restTemplate.exchange(
                "/api/neurons/{id}/permanent",
                HttpMethod.DELETE,
                null,
                Void.class,
                created.id());

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);
    }

    @Test
    void getRecent_returnsList() {
        createNeuron("Recent Note");

        ResponseEntity<List<NeuronResponse>> response = restTemplate.exchange(
                "/api/neurons/recent",
                HttpMethod.GET,
                null,
                new ParameterizedTypeReference<List<NeuronResponse>>() {});

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).isNotEmpty();
    }

    @Test
    void getFavorites_returnsList() {
        NeuronResponse created = createNeuron("Fav Note");
        restTemplate.postForEntity("/api/neurons/{id}/favorite", null, NeuronResponse.class, created.id());

        ResponseEntity<List<NeuronResponse>> response = restTemplate.exchange(
                "/api/neurons/favorites",
                HttpMethod.GET,
                null,
                new ParameterizedTypeReference<List<NeuronResponse>>() {});

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).isNotEmpty();
    }

    @Test
    void getPinned_returnsList() {
        NeuronResponse created = createNeuron("Pinned Note");
        restTemplate.postForEntity("/api/neurons/{id}/pin", null, NeuronResponse.class, created.id());

        ResponseEntity<List<NeuronResponse>> response = restTemplate.exchange(
                "/api/neurons/pinned",
                HttpMethod.GET,
                null,
                new ParameterizedTypeReference<List<NeuronResponse>>() {});

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).isNotEmpty();
    }
}
