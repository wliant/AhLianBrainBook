package com.wliant.brainbook.controller;

import com.wliant.brainbook.config.DatabaseCleaner;
import com.wliant.brainbook.config.TestContainersConfig;
import com.wliant.brainbook.dto.BrainRequest;
import com.wliant.brainbook.dto.BrainResponse;
import com.wliant.brainbook.dto.CreateClusterRequest;
import com.wliant.brainbook.dto.ClusterResponse;
import com.wliant.brainbook.dto.NeuronRequest;
import com.wliant.brainbook.dto.NeuronResponse;
import com.wliant.brainbook.dto.TagRequest;
import com.wliant.brainbook.dto.TagResponse;
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
class TagControllerIntegrationTest {

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

    private UUID createNeuron() {
        BrainRequest brainRequest = new BrainRequest("Brain", "icon", "#FF0000", null);
        ResponseEntity<BrainResponse> brainResponse = restTemplate.postForEntity(
                "/api/brains", brainRequest, BrainResponse.class);
        UUID brainId = brainResponse.getBody().id();

        CreateClusterRequest clusterRequest = new CreateClusterRequest("Cluster", brainId, null, null, null);
        ResponseEntity<ClusterResponse> clusterResponse = restTemplate.postForEntity(
                "/api/clusters", clusterRequest, ClusterResponse.class);
        UUID clusterId = clusterResponse.getBody().id();

        NeuronRequest neuronRequest = new NeuronRequest("Note", brainId, clusterId, "{}", "", null, null, null);
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

    @Test
    void searchTags_returnsMatches() {
        restTemplate.postForEntity("/api/tags", new TagRequest("JavaScript", "#FFFF00"), TagResponse.class);
        restTemplate.postForEntity("/api/tags", new TagRequest("Java", "#0000FF"), TagResponse.class);
        restTemplate.postForEntity("/api/tags", new TagRequest("Python", "#00FF00"), TagResponse.class);

        ResponseEntity<List<TagResponse>> response = restTemplate.exchange(
                "/api/tags/search?q=Java",
                HttpMethod.GET,
                null,
                new ParameterizedTypeReference<List<TagResponse>>() {});

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).hasSize(2);
    }

    @Test
    void removeTagFromNeuron_returns204() {
        UUID neuronId = createNeuron();
        UUID tagId = restTemplate.postForEntity(
                "/api/tags", new TagRequest("Java", "#0000FF"), TagResponse.class).getBody().id();
        restTemplate.postForEntity("/api/tags/neurons/{neuronId}/tags/{tagId}",
                null, Void.class, neuronId, tagId);

        ResponseEntity<Void> response = restTemplate.exchange(
                "/api/tags/neurons/{neuronId}/tags/{tagId}",
                HttpMethod.DELETE,
                null,
                Void.class,
                neuronId, tagId);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);
    }

    @Test
    void addTagToBrain_returns200() {
        BrainRequest brainReq = new BrainRequest("Brain", "icon", "#FF0000", null);
        UUID brainId = restTemplate.postForEntity("/api/brains", brainReq, BrainResponse.class).getBody().id();
        UUID tagId = restTemplate.postForEntity(
                "/api/tags", new TagRequest("DevOps", "#FF0000"), TagResponse.class).getBody().id();

        ResponseEntity<Void> response = restTemplate.postForEntity(
                "/api/tags/brains/{brainId}/tags/{tagId}",
                null, Void.class, brainId, tagId);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
    }

    @Test
    void removeTagFromBrain_returns204() {
        BrainRequest brainReq = new BrainRequest("Brain", "icon", "#FF0000", null);
        UUID brainId = restTemplate.postForEntity("/api/brains", brainReq, BrainResponse.class).getBody().id();
        UUID tagId = restTemplate.postForEntity(
                "/api/tags", new TagRequest("DevOps", "#FF0000"), TagResponse.class).getBody().id();
        restTemplate.postForEntity("/api/tags/brains/{brainId}/tags/{tagId}",
                null, Void.class, brainId, tagId);

        ResponseEntity<Void> response = restTemplate.exchange(
                "/api/tags/brains/{brainId}/tags/{tagId}",
                HttpMethod.DELETE,
                null,
                Void.class,
                brainId, tagId);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);
    }

    @Test
    void getTagsForBrain_returnsList() {
        BrainRequest brainReq = new BrainRequest("Brain", "icon", "#FF0000", null);
        UUID brainId = restTemplate.postForEntity("/api/brains", brainReq, BrainResponse.class).getBody().id();
        UUID tagId = restTemplate.postForEntity(
                "/api/tags", new TagRequest("DevOps", "#FF0000"), TagResponse.class).getBody().id();
        restTemplate.postForEntity("/api/tags/brains/{brainId}/tags/{tagId}",
                null, Void.class, brainId, tagId);

        ResponseEntity<List<TagResponse>> response = restTemplate.exchange(
                "/api/tags/brains/{brainId}/tags",
                HttpMethod.GET,
                null,
                new ParameterizedTypeReference<List<TagResponse>>() {},
                brainId);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).hasSize(1);
    }
}
