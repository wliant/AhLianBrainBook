package com.wliant.brainbook.controller;

import com.wliant.brainbook.config.DatabaseCleaner;
import com.wliant.brainbook.config.TestContainersConfig;
import com.wliant.brainbook.dto.BrainRequest;
import com.wliant.brainbook.dto.BrainResponse;
import com.wliant.brainbook.dto.ClusterRequest;
import com.wliant.brainbook.dto.ClusterResponse;
import com.wliant.brainbook.dto.NeuronRequest;
import com.wliant.brainbook.dto.NeuronResponse;
import com.wliant.brainbook.dto.SpacedRepetitionItemResponse;
import com.wliant.brainbook.dto.SpacedRepetitionReviewRequest;
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
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@Import(TestContainersConfig.class)
@ActiveProfiles("test")
class SpacedRepetitionControllerIntegrationTest {

    @MockitoBean
    private MinioClient minioClient;

    @Autowired
    private TestRestTemplate restTemplate;

    @Autowired
    private DatabaseCleaner databaseCleaner;

    private UUID brainId;
    private UUID clusterId;
    private UUID neuronId;

    @BeforeEach
    void cleanup() {
        databaseCleaner.clean();

        BrainRequest brainRequest = new BrainRequest("Test Brain", "icon", "#FF0000", null);
        ResponseEntity<BrainResponse> brainResponse = restTemplate.postForEntity(
                "/api/brains", brainRequest, BrainResponse.class);
        brainId = brainResponse.getBody().id();

        ClusterRequest clusterRequest = new ClusterRequest("Test Cluster", brainId, null);
        ResponseEntity<ClusterResponse> clusterResponse = restTemplate.postForEntity(
                "/api/clusters", clusterRequest, ClusterResponse.class);
        clusterId = clusterResponse.getBody().id();

        neuronId = createNeuron("Test Neuron").id();
    }

    private NeuronResponse createNeuron(String title) {
        NeuronRequest request = new NeuronRequest(title, brainId, clusterId, "{}", "", null, null);
        ResponseEntity<NeuronResponse> response = restTemplate.postForEntity(
                "/api/neurons", request, NeuronResponse.class);
        return response.getBody();
    }

    private SpacedRepetitionItemResponse addToSR(UUID nId) {
        ResponseEntity<SpacedRepetitionItemResponse> response = restTemplate.postForEntity(
                "/api/spaced-repetition/items/{neuronId}", null, SpacedRepetitionItemResponse.class, nId);
        return response.getBody();
    }

    // ── addItem ──

    @Test
    void addItem_returns201() {
        ResponseEntity<SpacedRepetitionItemResponse> response = restTemplate.postForEntity(
                "/api/spaced-repetition/items/{neuronId}", null, SpacedRepetitionItemResponse.class, neuronId);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().id()).isNotNull();
        assertThat(response.getBody().easeFactor()).isEqualTo(2.5);
        assertThat(response.getBody().intervalDays()).isZero();
        assertThat(response.getBody().repetitions()).isZero();

        // Verify neuronId via GET (the read-only column is populated on read)
        ResponseEntity<SpacedRepetitionItemResponse> fetched = restTemplate.getForEntity(
                "/api/spaced-repetition/items/{neuronId}", SpacedRepetitionItemResponse.class, neuronId);
        assertThat(fetched.getBody().neuronId()).isEqualTo(neuronId);
    }

    @Test
    void addItem_idempotent_returns201() {
        ResponseEntity<SpacedRepetitionItemResponse> first = restTemplate.postForEntity(
                "/api/spaced-repetition/items/{neuronId}", null, SpacedRepetitionItemResponse.class, neuronId);
        ResponseEntity<SpacedRepetitionItemResponse> second = restTemplate.postForEntity(
                "/api/spaced-repetition/items/{neuronId}", null, SpacedRepetitionItemResponse.class, neuronId);

        assertThat(first.getBody().id()).isEqualTo(second.getBody().id());
    }

    @Test
    void addItem_returns404ForUnknownNeuron() {
        ResponseEntity<Void> response = restTemplate.postForEntity(
                "/api/spaced-repetition/items/{neuronId}", null, Void.class, UUID.randomUUID());

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
    }

    // ── getItem ──

    @Test
    void getItem_returns200() {
        SpacedRepetitionItemResponse added = addToSR(neuronId);

        ResponseEntity<SpacedRepetitionItemResponse> response = restTemplate.getForEntity(
                "/api/spaced-repetition/items/{neuronId}", SpacedRepetitionItemResponse.class, neuronId);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody().id()).isEqualTo(added.id());
        assertThat(response.getBody().neuronId()).isEqualTo(neuronId);
    }

    @Test
    void getItem_returns404WhenNotInReview() {
        ResponseEntity<Void> response = restTemplate.getForEntity(
                "/api/spaced-repetition/items/{neuronId}", Void.class, neuronId);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
    }

    // ── removeItem ──

    @Test
    void removeItem_returns204() {
        addToSR(neuronId);

        ResponseEntity<Void> deleteResponse = restTemplate.exchange(
                "/api/spaced-repetition/items/{neuronId}", HttpMethod.DELETE, null, Void.class, neuronId);
        assertThat(deleteResponse.getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);

        ResponseEntity<Void> getResponse = restTemplate.getForEntity(
                "/api/spaced-repetition/items/{neuronId}", Void.class, neuronId);
        assertThat(getResponse.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
    }

    @Test
    void removeItem_returns204ForNonexistent() {
        ResponseEntity<Void> response = restTemplate.exchange(
                "/api/spaced-repetition/items/{neuronId}", HttpMethod.DELETE, null, Void.class, UUID.randomUUID());

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);
    }

    // ── getAllItems ──

    @Test
    void getAllItems_returns200WithList() {
        NeuronResponse neuron2 = createNeuron("Neuron 2");
        addToSR(neuronId);
        addToSR(neuron2.id());

        ResponseEntity<List<SpacedRepetitionItemResponse>> response = restTemplate.exchange(
                "/api/spaced-repetition/items", HttpMethod.GET, null,
                new ParameterizedTypeReference<List<SpacedRepetitionItemResponse>>() {});

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).hasSize(2);
    }

    @Test
    void getAllItems_returns200EmptyList() {
        ResponseEntity<List<SpacedRepetitionItemResponse>> response = restTemplate.exchange(
                "/api/spaced-repetition/items", HttpMethod.GET, null,
                new ParameterizedTypeReference<List<SpacedRepetitionItemResponse>>() {});

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).isEmpty();
    }

    // ── getReviewQueue ──

    @Test
    void getReviewQueue_returns200() {
        addToSR(neuronId);

        ResponseEntity<List<SpacedRepetitionItemResponse>> response = restTemplate.exchange(
                "/api/spaced-repetition/queue", HttpMethod.GET, null,
                new ParameterizedTypeReference<List<SpacedRepetitionItemResponse>>() {});

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).hasSize(1);
    }

    @Test
    void getReviewQueue_returns200EmptyWhenNoneDue() {
        SpacedRepetitionItemResponse item = addToSR(neuronId);
        // Submit a good review to push nextReviewAt into the future
        restTemplate.postForEntity(
                "/api/spaced-repetition/items/{itemId}/review",
                new SpacedRepetitionReviewRequest(5),
                SpacedRepetitionItemResponse.class,
                item.id());

        ResponseEntity<List<SpacedRepetitionItemResponse>> response = restTemplate.exchange(
                "/api/spaced-repetition/queue", HttpMethod.GET, null,
                new ParameterizedTypeReference<List<SpacedRepetitionItemResponse>>() {});

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).isEmpty();
    }

    // ── submitReview ──

    @Test
    void submitReview_returns200() {
        SpacedRepetitionItemResponse item = addToSR(neuronId);

        ResponseEntity<SpacedRepetitionItemResponse> response = restTemplate.postForEntity(
                "/api/spaced-repetition/items/{itemId}/review",
                new SpacedRepetitionReviewRequest(4),
                SpacedRepetitionItemResponse.class,
                item.id());

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody().repetitions()).isEqualTo(1);
        assertThat(response.getBody().intervalDays()).isEqualTo(1);
        assertThat(response.getBody().lastReviewedAt()).isNotNull();
    }

    @Test
    void submitReview_returns404ForUnknownItem() {
        ResponseEntity<Void> response = restTemplate.postForEntity(
                "/api/spaced-repetition/items/{itemId}/review",
                new SpacedRepetitionReviewRequest(3),
                Void.class,
                UUID.randomUUID());

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
    }

    @Test
    void submitReview_returns400ForQualityOutOfRange() {
        SpacedRepetitionItemResponse item = addToSR(neuronId);

        ResponseEntity<Void> tooHigh = restTemplate.postForEntity(
                "/api/spaced-repetition/items/{itemId}/review",
                Map.of("quality", 6),
                Void.class,
                item.id());
        assertThat(tooHigh.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);

        ResponseEntity<Void> tooLow = restTemplate.postForEntity(
                "/api/spaced-repetition/items/{itemId}/review",
                Map.of("quality", -1),
                Void.class,
                item.id());
        assertThat(tooLow.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
    }

    @Test
    void submitReview_returns400ForNullQuality() {
        SpacedRepetitionItemResponse item = addToSR(neuronId);

        ResponseEntity<Void> response = restTemplate.postForEntity(
                "/api/spaced-repetition/items/{itemId}/review",
                Map.of(),
                Void.class,
                item.id());

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
    }
}
