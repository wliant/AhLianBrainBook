package com.wliant.brainbook.controller;

import com.wliant.brainbook.config.TestContainersConfig;
import com.wliant.brainbook.dto.BrainRequest;
import com.wliant.brainbook.dto.BrainResponse;
import com.wliant.brainbook.dto.ClusterRequest;
import com.wliant.brainbook.dto.ClusterResponse;
import com.wliant.brainbook.dto.NeuronRequest;
import com.wliant.brainbook.dto.NeuronResponse;
import com.wliant.brainbook.dto.TagRequest;
import com.wliant.brainbook.dto.TagResponse;
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
class TagControllerIntegrationTest {

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
        // Clean neuron_tags join table first
        jdbcTemplate.execute("DELETE FROM neuron_tags");
        neuronRevisionRepository.deleteAll();
        attachmentRepository.deleteAll();
        neuronLinkRepository.deleteAll();
        neuronRepository.deleteAll();
        clusterRepository.deleteAll();
        brainRepository.deleteAll();
        tagRepository.deleteAll();
    }

    private UUID createNeuron() {
        BrainRequest brainRequest = new BrainRequest("Brain", "icon", "#FF0000");
        ResponseEntity<BrainResponse> brainResponse = restTemplate.postForEntity(
                "/api/brains", brainRequest, BrainResponse.class);
        UUID brainId = brainResponse.getBody().id();

        ClusterRequest clusterRequest = new ClusterRequest("Cluster", brainId, null);
        ResponseEntity<ClusterResponse> clusterResponse = restTemplate.postForEntity(
                "/api/clusters", clusterRequest, ClusterResponse.class);
        UUID clusterId = clusterResponse.getBody().id();

        NeuronRequest neuronRequest = new NeuronRequest("Note", brainId, clusterId, "{}", "", null);
        ResponseEntity<NeuronResponse> neuronResponse = restTemplate.postForEntity(
                "/api/neurons", neuronRequest, NeuronResponse.class);
        return neuronResponse.getBody().id();
    }

    @Test
    void createTag_succeeds() {
        TagRequest request = new TagRequest("Java", "#0000FF");

        ResponseEntity<TagResponse> response = restTemplate.postForEntity(
                "/api/tags", request, TagResponse.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().name()).isEqualTo("Java");
        assertThat(response.getBody().color()).isEqualTo("#0000FF");
        assertThat(response.getBody().id()).isNotNull();
    }

    @Test
    void getAllTags_returnsList() {
        restTemplate.postForEntity("/api/tags", new TagRequest("Java", "#0000FF"), TagResponse.class);
        restTemplate.postForEntity("/api/tags", new TagRequest("Spring", "#00FF00"), TagResponse.class);

        ResponseEntity<List<TagResponse>> response = restTemplate.exchange(
                "/api/tags",
                HttpMethod.GET,
                null,
                new ParameterizedTypeReference<List<TagResponse>>() {});

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).hasSize(2);
    }

    @Test
    void deleteTag_removes() {
        ResponseEntity<TagResponse> createResponse = restTemplate.postForEntity(
                "/api/tags", new TagRequest("ToDelete", "#FF0000"), TagResponse.class);
        UUID tagId = createResponse.getBody().id();

        ResponseEntity<Void> deleteResponse = restTemplate.exchange(
                "/api/tags/{id}",
                HttpMethod.DELETE,
                null,
                Void.class,
                tagId);

        assertThat(deleteResponse.getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);

        ResponseEntity<List<TagResponse>> listResponse = restTemplate.exchange(
                "/api/tags",
                HttpMethod.GET,
                null,
                new ParameterizedTypeReference<List<TagResponse>>() {});

        assertThat(listResponse.getBody()).isEmpty();
    }

    @Test
    void addTagToNeuron_links() {
        UUID neuronId = createNeuron();
        ResponseEntity<TagResponse> tagResponse = restTemplate.postForEntity(
                "/api/tags", new TagRequest("Java", "#0000FF"), TagResponse.class);
        UUID tagId = tagResponse.getBody().id();

        ResponseEntity<Void> response = restTemplate.postForEntity(
                "/api/tags/neurons/{neuronId}/tags/{tagId}",
                null,
                Void.class,
                neuronId,
                tagId);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
    }

    @Test
    void getTagsForNeuron_returnsTags() {
        UUID neuronId = createNeuron();

        ResponseEntity<TagResponse> tag1Response = restTemplate.postForEntity(
                "/api/tags", new TagRequest("Java", "#0000FF"), TagResponse.class);
        ResponseEntity<TagResponse> tag2Response = restTemplate.postForEntity(
                "/api/tags", new TagRequest("Spring", "#00FF00"), TagResponse.class);

        // Link both tags to neuron
        restTemplate.postForEntity(
                "/api/tags/neurons/{neuronId}/tags/{tagId}",
                null, Void.class, neuronId, tag1Response.getBody().id());
        restTemplate.postForEntity(
                "/api/tags/neurons/{neuronId}/tags/{tagId}",
                null, Void.class, neuronId, tag2Response.getBody().id());

        ResponseEntity<List<TagResponse>> response = restTemplate.exchange(
                "/api/tags/neurons/{neuronId}/tags",
                HttpMethod.GET,
                null,
                new ParameterizedTypeReference<List<TagResponse>>() {},
                neuronId);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).hasSize(2);
    }
}
