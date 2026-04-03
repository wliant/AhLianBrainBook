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
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
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

        when(intelligenceService.generateResearchGoal(anyString(), anyString()))
                .thenReturn("Test research goal");

        BrainRequest brainReq = new BrainRequest("Test Brain", "icon", "#FF0000", null);
        brainId = restTemplate.postForEntity("/api/brains", brainReq, BrainResponse.class)
                .getBody().id();

        aiClusterId = restTemplate.postForEntity("/api/clusters",
                new CreateClusterRequest("AI Research", brainId, "ai-research", null, null),
                ClusterResponse.class).getBody().id();

        knowledgeClusterId = restTemplate.postForEntity("/api/clusters",
                new CreateClusterRequest("Knowledge", brainId, null, null, null),
                ClusterResponse.class).getBody().id();
    }

    @Test
    void createTopic_returnsCreatedWithGeneratingStatus() {
        ResponseEntity<ResearchTopicResponse> response = restTemplate.postForEntity(
                "/api/clusters/{clusterId}/research-topics",
                new CreateResearchTopicRequest("Sorting algorithms"),
                ResearchTopicResponse.class,
                aiClusterId);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        assertThat(response.getBody().title()).isEqualTo("Sorting algorithms");
        assertThat(response.getBody().status()).isEqualTo("generating");
        assertThat(response.getBody().clusterId()).isEqualTo(aiClusterId);
    }

    @Test
    void createTopic_withNullPrompt_returnsCreated() {
        ResponseEntity<ResearchTopicResponse> response = restTemplate.postForEntity(
                "/api/clusters/{clusterId}/research-topics",
                new CreateResearchTopicRequest(null),
                ResearchTopicResponse.class,
                aiClusterId);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        assertThat(response.getBody().status()).isEqualTo("generating");
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
        restTemplate.postForEntity("/api/clusters/{id}/research-topics",
                new CreateResearchTopicRequest("Topic 1"), ResearchTopicResponse.class, aiClusterId);
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
    void deleteTopic_returnsNoContent() {
        ResearchTopicResponse created = restTemplate.postForEntity(
                "/api/clusters/{id}/research-topics",
                new CreateResearchTopicRequest("To Delete"),
                ResearchTopicResponse.class, aiClusterId).getBody();

        ResponseEntity<Void> response = restTemplate.exchange(
                "/api/clusters/{clusterId}/research-topics/{id}",
                HttpMethod.DELETE, null, Void.class, aiClusterId, created.id());

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);
    }
}
