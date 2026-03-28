package com.wliant.brainbook.controller;

import com.wliant.brainbook.config.TestContainersConfig;
import com.wliant.brainbook.dto.BrainRequest;
import com.wliant.brainbook.dto.BrainResponse;
import com.wliant.brainbook.dto.ClusterRequest;
import com.wliant.brainbook.dto.ClusterResponse;
import com.wliant.brainbook.dto.NeuronContentRequest;
import com.wliant.brainbook.dto.NeuronRequest;
import com.wliant.brainbook.dto.NeuronResponse;
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
class NeuronControllerIntegrationTest {

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

    private UUID brainId;
    private UUID clusterId;

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

        // Create brain and cluster for neuron tests
        BrainRequest brainRequest = new BrainRequest("Test Brain", "icon", "#FF0000");
        ResponseEntity<BrainResponse> brainResponse = restTemplate.postForEntity(
                "/api/brains", brainRequest, BrainResponse.class);
        brainId = brainResponse.getBody().id();

        ClusterRequest clusterRequest = new ClusterRequest("Test Cluster", brainId, null);
        ResponseEntity<ClusterResponse> clusterResponse = restTemplate.postForEntity(
                "/api/clusters", clusterRequest, ClusterResponse.class);
        clusterId = clusterResponse.getBody().id();
    }

    private NeuronResponse createNeuron(String title) {
        NeuronRequest request = new NeuronRequest(title, brainId, clusterId, "{}", "", null);
        ResponseEntity<NeuronResponse> response = restTemplate.postForEntity(
                "/api/neurons", request, NeuronResponse.class);
        return response.getBody();
    }

    @Test
    void createNeuron_succeeds() {
        NeuronRequest request = new NeuronRequest("My Note", brainId, clusterId,
                "{\"type\":\"doc\"}", "plain text", null);

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
}
