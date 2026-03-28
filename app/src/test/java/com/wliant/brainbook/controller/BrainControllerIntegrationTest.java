package com.wliant.brainbook.controller;

import com.wliant.brainbook.config.TestContainersConfig;
import com.wliant.brainbook.dto.BrainRequest;
import com.wliant.brainbook.dto.BrainResponse;
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
class BrainControllerIntegrationTest {

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

    @Test
    void listBrains_returnsEmptyList() {
        ResponseEntity<List<BrainResponse>> response = restTemplate.exchange(
                "/api/brains",
                HttpMethod.GET,
                null,
                new ParameterizedTypeReference<List<BrainResponse>>() {});

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).isEmpty();
    }

    @Test
    void createBrain_returns201() {
        BrainRequest request = new BrainRequest("My Brain", "brain-icon", "#FF0000");

        ResponseEntity<BrainResponse> response = restTemplate.postForEntity(
                "/api/brains", request, BrainResponse.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().name()).isEqualTo("My Brain");
        assertThat(response.getBody().icon()).isEqualTo("brain-icon");
        assertThat(response.getBody().color()).isEqualTo("#FF0000");
        assertThat(response.getBody().id()).isNotNull();
    }

    @Test
    void getBrain_returnsBrain() {
        BrainRequest request = new BrainRequest("Test Brain", "icon", "#00FF00");
        ResponseEntity<BrainResponse> createResponse = restTemplate.postForEntity(
                "/api/brains", request, BrainResponse.class);
        UUID brainId = createResponse.getBody().id();

        ResponseEntity<BrainResponse> response = restTemplate.getForEntity(
                "/api/brains/{id}", BrainResponse.class, brainId);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().name()).isEqualTo("Test Brain");
        assertThat(response.getBody().id()).isEqualTo(brainId);
    }

    @Test
    void getBrain_returns404WhenNotFound() {
        UUID randomId = UUID.randomUUID();

        ResponseEntity<String> response = restTemplate.getForEntity(
                "/api/brains/{id}", String.class, randomId);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
    }

    @Test
    void updateBrain_modifiesBrain() {
        BrainRequest createRequest = new BrainRequest("Original", "icon", "#000000");
        ResponseEntity<BrainResponse> createResponse = restTemplate.postForEntity(
                "/api/brains", createRequest, BrainResponse.class);
        UUID brainId = createResponse.getBody().id();

        BrainRequest updateRequest = new BrainRequest("Updated", "new-icon", "#FFFFFF");
        ResponseEntity<BrainResponse> response = restTemplate.exchange(
                "/api/brains/{id}",
                HttpMethod.PATCH,
                new HttpEntity<>(updateRequest),
                BrainResponse.class,
                brainId);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().name()).isEqualTo("Updated");
        assertThat(response.getBody().icon()).isEqualTo("new-icon");
        assertThat(response.getBody().color()).isEqualTo("#FFFFFF");
    }

    @Test
    void deleteBrain_removes() {
        BrainRequest request = new BrainRequest("To Delete", "icon", "#FF0000");
        ResponseEntity<BrainResponse> createResponse = restTemplate.postForEntity(
                "/api/brains", request, BrainResponse.class);
        UUID brainId = createResponse.getBody().id();

        ResponseEntity<Void> deleteResponse = restTemplate.exchange(
                "/api/brains/{id}",
                HttpMethod.DELETE,
                null,
                Void.class,
                brainId);

        assertThat(deleteResponse.getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);

        ResponseEntity<String> getResponse = restTemplate.getForEntity(
                "/api/brains/{id}", String.class, brainId);
        assertThat(getResponse.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
    }
}
