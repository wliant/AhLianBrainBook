package com.wliant.brainbook.controller;

import com.wliant.brainbook.config.DatabaseCleaner;
import com.wliant.brainbook.config.TestContainersConfig;
import com.wliant.brainbook.dto.BrainRequest;
import com.wliant.brainbook.dto.BrainResponse;
import com.wliant.brainbook.dto.ClusterRequest;
import com.wliant.brainbook.dto.ClusterResponse;
import com.wliant.brainbook.dto.NeuronContentRequest;
import com.wliant.brainbook.dto.NeuronRequest;
import com.wliant.brainbook.dto.NeuronResponse;
import com.wliant.brainbook.dto.RevisionResponse;
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
class RevisionControllerIntegrationTest {

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

        BrainRequest brainRequest = new BrainRequest("Test Brain", "icon", "#FF0000", null);
        ResponseEntity<BrainResponse> brainResponse = restTemplate.postForEntity(
                "/api/brains", brainRequest, BrainResponse.class);
        brainId = brainResponse.getBody().id();

        ClusterRequest clusterRequest = new ClusterRequest("Test Cluster", brainId);
        ResponseEntity<ClusterResponse> clusterResponse = restTemplate.postForEntity(
                "/api/clusters", clusterRequest, ClusterResponse.class);
        clusterId = clusterResponse.getBody().id();
    }

    private NeuronResponse createNeuron(String title, String contentJson, String contentText) {
        NeuronRequest request = new NeuronRequest(title, brainId, clusterId, contentJson, contentText, null, null);
        ResponseEntity<NeuronResponse> response = restTemplate.postForEntity(
                "/api/neurons", request, NeuronResponse.class);
        return response.getBody();
    }

    private RevisionResponse createRevision(UUID neuronId) {
        ResponseEntity<RevisionResponse> response = restTemplate.postForEntity(
                "/api/neurons/{neuronId}/revisions", null, RevisionResponse.class, neuronId);
        return response.getBody();
    }

    @Test
    void createRevision_createsSnapshot() {
        NeuronResponse neuron = createNeuron("My Note", "{\"doc\":true}", "some text");

        ResponseEntity<RevisionResponse> response = restTemplate.postForEntity(
                "/api/neurons/{neuronId}/revisions", null, RevisionResponse.class, neuron.id());

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().revisionNumber()).isEqualTo(1);
        assertThat(response.getBody().title()).isEqualTo("My Note");
        assertThat(response.getBody().neuronId()).isEqualTo(neuron.id());
    }

    @Test
    void createRevision_returns404ForNonexistentNeuron() {
        ResponseEntity<String> response = restTemplate.postForEntity(
                "/api/neurons/{neuronId}/revisions", null, String.class, UUID.randomUUID());

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
    }

    @Test
    void getRevisions_returnsRevisionsForNeuron() {
        NeuronResponse neuron = createNeuron("Note", "{}", "text");
        createRevision(neuron.id());
        createRevision(neuron.id());

        ResponseEntity<List<RevisionResponse>> response = restTemplate.exchange(
                "/api/neurons/{neuronId}/revisions",
                HttpMethod.GET,
                null,
                new ParameterizedTypeReference<List<RevisionResponse>>() {},
                neuron.id());

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).hasSize(2);
    }

    @Test
    void getRevision_returnsSingleRevision() {
        NeuronResponse neuron = createNeuron("Note", "{}", "text");
        RevisionResponse created = createRevision(neuron.id());

        ResponseEntity<RevisionResponse> response = restTemplate.getForEntity(
                "/api/revisions/{revisionId}", RevisionResponse.class, created.id());

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().id()).isEqualTo(created.id());
        assertThat(response.getBody().neuronId()).isEqualTo(neuron.id());
    }

    @Test
    void getRevision_returns404ForNonexistent() {
        ResponseEntity<String> response = restTemplate.getForEntity(
                "/api/revisions/{revisionId}", String.class, UUID.randomUUID());

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
    }

    @Test
    void restoreRevision_restoresContent() {
        NeuronResponse neuron = createNeuron("Note", "{\"v\":1}", "original");
        RevisionResponse revision = createRevision(neuron.id());

        // Update content to something different
        NeuronContentRequest contentUpdate = new NeuronContentRequest("{\"v\":2}", "changed", neuron.version());
        restTemplate.exchange("/api/neurons/{id}/content", HttpMethod.PUT,
                new HttpEntity<>(contentUpdate), NeuronResponse.class, neuron.id());

        // Restore to original
        ResponseEntity<NeuronResponse> response = restTemplate.postForEntity(
                "/api/revisions/{revisionId}/restore", null, NeuronResponse.class, revision.id());

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().contentJson()).isEqualTo("{\"v\": 1}");
        assertThat(response.getBody().contentText()).isEqualTo("original");
    }

    @Test
    void restoreRevision_returns404ForNonexistent() {
        ResponseEntity<String> response = restTemplate.postForEntity(
                "/api/revisions/{revisionId}/restore", null, String.class, UUID.randomUUID());

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
    }

    @Test
    void deleteRevision_removesRevision() {
        NeuronResponse neuron = createNeuron("Note", "{}", "text");
        RevisionResponse revision = createRevision(neuron.id());

        ResponseEntity<Void> deleteResponse = restTemplate.exchange(
                "/api/revisions/{revisionId}",
                HttpMethod.DELETE,
                null,
                Void.class,
                revision.id());

        assertThat(deleteResponse.getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);

        // Verify it's gone
        ResponseEntity<List<RevisionResponse>> listResponse = restTemplate.exchange(
                "/api/neurons/{neuronId}/revisions",
                HttpMethod.GET,
                null,
                new ParameterizedTypeReference<List<RevisionResponse>>() {},
                neuron.id());

        assertThat(listResponse.getBody()).isEmpty();
    }

    @Test
    void deleteRevision_returns404ForNonexistent() {
        ResponseEntity<String> response = restTemplate.exchange(
                "/api/revisions/{revisionId}",
                HttpMethod.DELETE,
                null,
                String.class,
                UUID.randomUUID());

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
    }
}
