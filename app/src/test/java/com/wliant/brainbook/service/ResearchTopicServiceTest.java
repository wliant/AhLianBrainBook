package com.wliant.brainbook.service;

import com.wliant.brainbook.config.DatabaseCleaner;
import com.wliant.brainbook.config.TestContainersConfig;
import com.wliant.brainbook.config.TestDataFactory;
import com.wliant.brainbook.dto.BrainResponse;
import com.wliant.brainbook.dto.ClusterResponse;
import com.wliant.brainbook.dto.CreateResearchTopicRequest;
import com.wliant.brainbook.dto.ReorderRequest;
import com.wliant.brainbook.dto.ResearchTopicResponse;
import com.wliant.brainbook.exception.ConflictException;
import com.wliant.brainbook.exception.ResourceNotFoundException;
import com.wliant.brainbook.repository.ResearchTopicRepository;
import io.minio.MinioClient;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;

@SpringBootTest
@Import(TestContainersConfig.class)
@ActiveProfiles("test")
class ResearchTopicServiceTest {

    @MockitoBean
    private MinioClient minioClient;

    @MockitoBean
    private IntelligenceService intelligenceService;

    @Autowired
    private ResearchTopicService researchTopicService;

    @Autowired
    private ResearchTopicRepository researchTopicRepository;

    @Autowired
    private DatabaseCleaner databaseCleaner;

    @Autowired
    private TestDataFactory testDataFactory;

    private UUID brainId;
    private UUID aiResearchClusterId;
    private UUID knowledgeClusterId;

    @BeforeEach
    void setUp() {
        databaseCleaner.clean();

        when(intelligenceService.generateResearchGoal(anyString(), anyList()))
                .thenReturn("Test research goal");

        BrainResponse brain = testDataFactory.createBrain();
        brainId = brain.id();
        ClusterResponse aiCluster = testDataFactory.createAiResearchCluster(brainId);
        aiResearchClusterId = aiCluster.id();
        ClusterResponse knowledgeCluster = testDataFactory.createCluster(brainId);
        knowledgeClusterId = knowledgeCluster.id();
    }

    @Test
    void create_returnsTopicInGeneratingStatus() {
        ResearchTopicResponse response = researchTopicService.create(
                aiResearchClusterId, new CreateResearchTopicRequest("Sorting algorithms"));

        assertThat(response.id()).isNotNull();
        assertThat(response.title()).isEqualTo("Sorting algorithms");
        assertThat(response.prompt()).isEqualTo("Sorting algorithms");
        assertThat(response.status()).isEqualTo("generating");
        assertThat(response.clusterId()).isEqualTo(aiResearchClusterId);
    }

    @Test
    void create_withNullPrompt_returnsTopicInGeneratingStatus() {
        ResearchTopicResponse response = researchTopicService.create(
                aiResearchClusterId, new CreateResearchTopicRequest(null));

        assertThat(response.id()).isNotNull();
        assertThat(response.title()).isEqualTo("Generating...");
        assertThat(response.status()).isEqualTo("generating");
    }

    @Test
    void create_rejectsKnowledgeCluster() {
        assertThatThrownBy(() -> researchTopicService.create(
                knowledgeClusterId, new CreateResearchTopicRequest("Test")))
                .isInstanceOf(ConflictException.class)
                .hasMessageContaining("AI Research clusters");
    }

    @Test
    void list_returnsTopicsInOrder() {
        researchTopicService.create(aiResearchClusterId, new CreateResearchTopicRequest("Topic A"));
        researchTopicService.create(aiResearchClusterId, new CreateResearchTopicRequest("Topic B"));

        List<ResearchTopicResponse> topics = researchTopicService.list(aiResearchClusterId);

        assertThat(topics).hasSize(2);
    }

    @Test
    void getById_returnsTopic() {
        ResearchTopicResponse created = researchTopicService.create(
                aiResearchClusterId, new CreateResearchTopicRequest("Test Topic"));

        ResearchTopicResponse found = researchTopicService.getById(created.id());

        assertThat(found.id()).isEqualTo(created.id());
    }

    @Test
    void getById_throwsWhenNotFound() {
        assertThatThrownBy(() -> researchTopicService.getById(UUID.randomUUID()))
                .isInstanceOf(ResourceNotFoundException.class);
    }

    @Test
    void delete_removesTopic() {
        ResearchTopicResponse created = researchTopicService.create(
                aiResearchClusterId, new CreateResearchTopicRequest("To Delete"));

        researchTopicService.delete(created.id());

        assertThat(researchTopicRepository.findById(created.id())).isEmpty();
    }

    @Test
    void update_setsStatusToUpdating() {
        ResearchTopicResponse created = researchTopicService.create(
                aiResearchClusterId, new CreateResearchTopicRequest("Test Topic"));

        ResearchTopicResponse updated = researchTopicService.update(created.id());

        assertThat(updated.status()).isEqualTo("updating");
    }

    @Test
    void reorder_updatesSortOrders() {
        ResearchTopicResponse t1 = researchTopicService.create(
                aiResearchClusterId, new CreateResearchTopicRequest("A"));
        ResearchTopicResponse t2 = researchTopicService.create(
                aiResearchClusterId, new CreateResearchTopicRequest("B"));
        ResearchTopicResponse t3 = researchTopicService.create(
                aiResearchClusterId, new CreateResearchTopicRequest("C"));

        researchTopicService.reorder(new ReorderRequest(List.of(t3.id(), t1.id(), t2.id())));

        List<ResearchTopicResponse> reordered = researchTopicService.list(aiResearchClusterId);
        assertThat(reordered.get(0).title()).isEqualTo("C");
        assertThat(reordered.get(1).title()).isEqualTo("A");
        assertThat(reordered.get(2).title()).isEqualTo("B");
    }
}
