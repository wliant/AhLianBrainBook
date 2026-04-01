package com.wliant.brainbook.controller;

import com.wliant.brainbook.config.DatabaseCleaner;
import com.wliant.brainbook.config.TestContainersConfig;
import com.wliant.brainbook.dto.BrainRequest;
import com.wliant.brainbook.dto.BrainResponse;
import com.wliant.brainbook.dto.CreateClusterRequest;
import com.wliant.brainbook.dto.ClusterResponse;
import com.wliant.brainbook.dto.CreateResearchTopicRequest;
import com.wliant.brainbook.dto.ResearchTopicResponse;
import com.wliant.brainbook.service.IntelligenceService;
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
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@Import(TestContainersConfig.class)
@ActiveProfiles("test")
class ResearchTopicControllerIntegrationTest {

    @MockitoBean
    private MinioClient minioClient;

    @MockitoBean
    private IntelligenceService intelligenceService;

    @Autowired
    private TestRestTemplate restTemplate;

    @Autowired
    private DatabaseCleaner databaseCleaner;

    private UUID brainId;
    private UUID aiClusterId;
    private UUID knowledgeClusterId;

    @BeforeEach
    void setUp() {
        databaseCleaner.clean();

        when(intelligenceService.generateResearchGoal(anyString(), anyList()))
                .thenReturn("Test research goal");

        BrainRequest brainReq = new BrainRequest("Test Brain", "icon", "#FF0000", null);
        brainId = restTemplate.postForEntity("/api/brains", brainReq, BrainResponse.class)
                .getBody().id();

        aiClusterId = restTemplate.postForEntity("/api/clusters",
                new CreateClusterRequest("AI Research", brainId, "ai-research"),
                ClusterResponse.class).getBody().id();

        knowledgeClusterId = restTemplate.postForEntity("/api/clusters",
                new CreateClusterRequest("Knowledge", brainId, null),
                ClusterResponse.class).getBody().id();
    }

    private void mockTopicGeneration(String title) {
        when(intelligenceService.generateResearchTopic(anyString(), anyString(), anyString(), anyList()))
                .thenReturn(Map.of(
                        "title", title,
                        "overall_completeness", "none",
                        "items", List.of(Map.of(
                                "id", "item-1", "text", "Concept",
                                "explanation", "Test", "completeness", "none",
                                "linked_neuron_ids", List.of(), "children", List.of()))
                ));
    }

    @Test
    void createTopic_returnsCreated() {
        mockTopicGeneration("Refactoring");

        ResponseEntity<ResearchTopicResponse> response = restTemplate.postForEntity(
                "/api/clusters/{clusterId}/research-topics",
                new CreateResearchTopicRequest("Refactoring techniques"),
                ResearchTopicResponse.class,
                aiClusterId);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        assertThat(response.getBody().title()).isEqualTo("Refactoring");
        assertThat(response.getBody().clusterId()).isEqualTo(aiClusterId);
    }

    @Test
    void createTopic_onKnowledgeCluster_returns409() {
        ResponseEntity<String> response = restTemplate.postForEntity(
                "/api/clusters/{clusterId}/research-topics",
                new CreateResearchTopicRequest("Test"),
                String.class,
                knowledgeClusterId);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
    }

    @Test
    void listTopics_returnsList() {
        mockTopicGeneration("Topic 1");
        restTemplate.postForEntity("/api/clusters/{id}/research-topics",
                new CreateResearchTopicRequest("Topic 1"), ResearchTopicResponse.class, aiClusterId);
        mockTopicGeneration("Topic 2");
        restTemplate.postForEntity("/api/clusters/{id}/research-topics",
                new CreateResearchTopicRequest("Topic 2"), ResearchTopicResponse.class, aiClusterId);

        ResponseEntity<List<ResearchTopicResponse>> response = restTemplate.exchange(
                "/api/clusters/{id}/research-topics",
                HttpMethod.GET, null,
                new ParameterizedTypeReference<List<ResearchTopicResponse>>() {},
                aiClusterId);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).hasSize(2);
    }

    @Test
    void getTopic_returnsTopic() {
        mockTopicGeneration("My Topic");
        ResearchTopicResponse created = restTemplate.postForEntity(
                "/api/clusters/{id}/research-topics",
                new CreateResearchTopicRequest("My Topic"),
                ResearchTopicResponse.class, aiClusterId).getBody();

        ResponseEntity<ResearchTopicResponse> response = restTemplate.getForEntity(
                "/api/clusters/{clusterId}/research-topics/{id}",
                ResearchTopicResponse.class, aiClusterId, created.id());

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody().title()).isEqualTo("My Topic");
    }

    @Test
    void deleteTopic_returnsNoContent() {
        mockTopicGeneration("To Delete");
        ResearchTopicResponse created = restTemplate.postForEntity(
                "/api/clusters/{id}/research-topics",
                new CreateResearchTopicRequest("To Delete"),
                ResearchTopicResponse.class, aiClusterId).getBody();

        ResponseEntity<Void> response = restTemplate.exchange(
                "/api/clusters/{clusterId}/research-topics/{id}",
                HttpMethod.DELETE, null, Void.class, aiClusterId, created.id());

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);

        // Verify deleted
        ResponseEntity<List<ResearchTopicResponse>> listResponse = restTemplate.exchange(
                "/api/clusters/{id}/research-topics",
                HttpMethod.GET, null,
                new ParameterizedTypeReference<List<ResearchTopicResponse>>() {},
                aiClusterId);
        assertThat(listResponse.getBody()).isEmpty();
    }
}
