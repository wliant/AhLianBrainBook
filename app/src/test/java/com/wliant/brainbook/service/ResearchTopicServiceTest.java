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
import com.wliant.brainbook.model.CompletenessLevel;
import com.wliant.brainbook.model.ResearchTopic;
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
import static org.mockito.ArgumentMatchers.any;
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

        // Mock intelligence service to return empty goal (avoid real AI calls)
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
    void create_generatesTopicInAiResearchCluster() {
        when(intelligenceService.generateResearchTopic(anyString(), anyString(), anyString(), anyList()))
                .thenReturn(Map.of(
                        "title", "Refactoring Techniques",
                        "overall_completeness", "none",
                        "items", List.of(
                                Map.of("id", "item-1", "text", "Extract Method",
                                        "explanation", "Moving code into a method",
                                        "completeness", "none",
                                        "linked_neuron_ids", List.of(),
                                        "children", List.of())
                        )
                ));

        ResearchTopicResponse response = researchTopicService.create(
                aiResearchClusterId, new CreateResearchTopicRequest("Refactoring techniques"));

        assertThat(response.id()).isNotNull();
        assertThat(response.title()).isEqualTo("Refactoring Techniques");
        assertThat(response.prompt()).isEqualTo("Refactoring techniques");
        assertThat(response.overallCompleteness()).isEqualTo("none");
        assertThat(response.contentJson()).isNotNull();

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> items = (List<Map<String, Object>>) response.contentJson().get("items");
        assertThat(items).hasSize(1);
        assertThat(items.get(0).get("text")).isEqualTo("Extract Method");
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
        createTestTopic("Topic A");
        createTestTopic("Topic B");

        List<ResearchTopicResponse> topics = researchTopicService.list(aiResearchClusterId);

        assertThat(topics).hasSize(2);
    }

    @Test
    void getById_returnsTopic() {
        ResearchTopicResponse created = createTestTopic("Test Topic");

        ResearchTopicResponse found = researchTopicService.getById(created.id());

        assertThat(found.id()).isEqualTo(created.id());
        assertThat(found.title()).isEqualTo("Test Topic");
    }

    @Test
    void getById_throwsWhenNotFound() {
        assertThatThrownBy(() -> researchTopicService.getById(UUID.randomUUID()))
                .isInstanceOf(ResourceNotFoundException.class);
    }

    @Test
    void delete_removesTopic() {
        ResearchTopicResponse created = createTestTopic("To Delete");

        researchTopicService.delete(created.id());

        assertThat(researchTopicRepository.findById(created.id())).isEmpty();
    }

    @Test
    void reorder_updatesSortOrders() {
        ResearchTopicResponse t1 = createTestTopic("A");
        ResearchTopicResponse t2 = createTestTopic("B");
        ResearchTopicResponse t3 = createTestTopic("C");

        researchTopicService.reorder(new ReorderRequest(List.of(t3.id(), t1.id(), t2.id())));

        List<ResearchTopicResponse> reordered = researchTopicService.list(aiResearchClusterId);
        assertThat(reordered.get(0).title()).isEqualTo("C");
        assertThat(reordered.get(1).title()).isEqualTo("A");
        assertThat(reordered.get(2).title()).isEqualTo("B");
    }

    @Test
    void refresh_updatesScoresAndCompleteness() {
        ResearchTopicResponse created = createTestTopic("Test Topic");

        when(intelligenceService.scoreResearchTopic(anyList(), anyString(), anyString(), anyList()))
                .thenReturn(Map.of(
                        "overall_completeness", "partial",
                        "items", List.of(
                                Map.of("id", "item-1", "text", "Extract Method",
                                        "explanation", "Moving code into a method",
                                        "completeness", "partial",
                                        "linked_neuron_ids", List.of(),
                                        "children", List.of())
                        )
                ));

        ResearchTopicResponse refreshed = researchTopicService.refresh(created.id());

        assertThat(refreshed.overallCompleteness()).isEqualTo("partial");
        assertThat(refreshed.lastRefreshedAt()).isNotNull();
    }

    @Test
    void expandBullet_addsChildren() {
        ResearchTopicResponse created = createTestTopic("Test Topic");

        when(intelligenceService.expandBullet(any(), anyString(), anyString(), anyString(), anyList()))
                .thenReturn(Map.of(
                        "children", List.of(
                                Map.of("id", "item-1-1", "text", "When to extract",
                                        "explanation", "Signs of too-long methods",
                                        "completeness", "none",
                                        "linked_neuron_ids", List.of(),
                                        "children", List.of()),
                                Map.of("id", "item-1-2", "text", "Mechanics",
                                        "explanation", "Step by step process",
                                        "completeness", "none",
                                        "linked_neuron_ids", List.of(),
                                        "children", List.of())
                        )
                ));

        ResearchTopicResponse expanded = researchTopicService.expandBullet(created.id(), "item-1");

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> items = (List<Map<String, Object>>) expanded.contentJson().get("items");
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> children = (List<Map<String, Object>>) items.get(0).get("children");
        assertThat(children).hasSize(2);
        assertThat(children.get(0).get("text")).isEqualTo("When to extract");
    }

    private ResearchTopicResponse createTestTopic(String title) {
        when(intelligenceService.generateResearchTopic(anyString(), anyString(), anyString(), anyList()))
                .thenReturn(Map.of(
                        "title", title,
                        "overall_completeness", "none",
                        "items", List.of(
                                Map.of("id", "item-1", "text", "Extract Method",
                                        "explanation", "Test",
                                        "completeness", "none",
                                        "linked_neuron_ids", List.of(),
                                        "children", List.of())
                        )
                ));
        return researchTopicService.create(
                aiResearchClusterId, new CreateResearchTopicRequest(title));
    }
}
