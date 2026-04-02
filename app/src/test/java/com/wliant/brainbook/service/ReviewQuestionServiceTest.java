package com.wliant.brainbook.service;

import com.wliant.brainbook.config.DatabaseCleaner;
import com.wliant.brainbook.config.TestContainersConfig;
import com.wliant.brainbook.dto.NeuronContentRequest;
import com.wliant.brainbook.dto.NeuronResponse;
import com.wliant.brainbook.dto.ReviewQuestionResponse;
import com.wliant.brainbook.dto.SpacedRepetitionItemResponse;
import com.wliant.brainbook.config.TestDataFactory;
import com.wliant.brainbook.model.Neuron;
import com.wliant.brainbook.repository.NeuronRepository;
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
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;

@SpringBootTest
@Import(TestContainersConfig.class)
@ActiveProfiles("test")
class ReviewQuestionServiceTest {

    @MockitoBean
    private MinioClient minioClient;

    @MockitoBean
    private IntelligenceService intelligenceService;

    @Autowired
    private ReviewQuestionService reviewQuestionService;

    @Autowired
    private SpacedRepetitionService srService;

    @Autowired
    private NeuronService neuronService;

    @Autowired
    private NeuronRepository neuronRepository;

    @Autowired
    private DatabaseCleaner databaseCleaner;

    @Autowired
    private TestDataFactory testDataFactory;

    private UUID neuronId;
    private UUID brainId;
    private UUID clusterId;

    private static final String CONTENT_JSON = """
            {"sections":[{"id":"s1","type":"rich-text","order":0,"content":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"This is a substantial test note about dependency injection in Spring Framework. It covers constructor injection, setter injection, and field injection patterns."}]}]}}]}""";

    private static final String CONTENT_TEXT = "This is a substantial test note about dependency injection in Spring Framework. "
            + "It covers constructor injection, setter injection, and field injection patterns. "
            + "Dependency injection is a fundamental concept in modern software engineering.";

    @BeforeEach
    void setUp() {
        databaseCleaner.clean();
        TestDataFactory.BrainClusterNeuron chain = testDataFactory.createFullChain();
        brainId = chain.brain().id();
        clusterId = chain.cluster().id();
        neuronId = chain.neuron().id();

        // Update neuron with substantive content
        neuronService.updateContent(neuronId, new NeuronContentRequest(CONTENT_JSON, CONTENT_TEXT, 1));
    }

    @Test
    void isSubstantiveContent_returnsTrueForRichTextContent() {
        Neuron neuron = neuronRepository.findById(neuronId).orElseThrow();
        assertThat(reviewQuestionService.isSubstantiveContent(neuron)).isTrue();
    }

    @Test
    void isSubstantiveContent_returnsFalseForNullContent() {
        NeuronResponse shortNeuron = testDataFactory.createNeuron("Short", brainId, clusterId);
        Neuron neuron = neuronRepository.findById(shortNeuron.id()).orElseThrow();
        assertThat(reviewQuestionService.isSubstantiveContent(neuron)).isFalse();
    }

    @Test
    void isSubstantiveContent_returnsFalseForShortContent() {
        NeuronResponse n = testDataFactory.createNeuron("Short", brainId, clusterId);
        neuronService.updateContent(n.id(), new NeuronContentRequest(
                "{\"sections\":[{\"id\":\"s1\",\"type\":\"rich-text\",\"order\":0,\"content\":{}}]}",
                "Short text",
                1
        ));
        Neuron neuron = neuronRepository.findById(n.id()).orElseThrow();
        assertThat(reviewQuestionService.isSubstantiveContent(neuron)).isFalse();
    }

    @Test
    void computeContentHash_returnsSameHashForSameContent() {
        String hash1 = reviewQuestionService.computeContentHash("test content");
        String hash2 = reviewQuestionService.computeContentHash("test content");
        assertThat(hash1).isEqualTo(hash2);
    }

    @Test
    void computeContentHash_returnsDifferentHashForDifferentContent() {
        String hash1 = reviewQuestionService.computeContentHash("content A");
        String hash2 = reviewQuestionService.computeContentHash("content B");
        assertThat(hash1).isNotEqualTo(hash2);
    }

    @Test
    void computeContentHash_handlesNull() {
        assertThat(reviewQuestionService.computeContentHash(null)).isEmpty();
    }

    @Test
    void generateQuestionsForItem_createsQuestions() {
        when(intelligenceService.generateReviewQA(anyString(), anyString(), anyInt(), anyString(), any()))
                .thenReturn(Map.of(
                        "items", List.of(
                                Map.of("question", "What is DI?", "answer", "Dependency injection is..."),
                                Map.of("question", "Name two types", "answer", "Constructor and setter injection")
                        )
                ));

        SpacedRepetitionItemResponse srItem = srService.addItem(neuronId);

        reviewQuestionService.generateQuestionsForItem(srItem.id());

        List<ReviewQuestionResponse> questions = reviewQuestionService.getQuestionsForItem(srItem.id());
        assertThat(questions).hasSize(2);
        assertThat(questions.get(0).questionText()).isEqualTo("What is DI?");
        assertThat(questions.get(1).answerText()).isEqualTo("Constructor and setter injection");
        assertThat(questions.get(0).questionOrder()).isEqualTo(0);
        assertThat(questions.get(1).questionOrder()).isEqualTo(1);
    }

    @Test
    void generateQuestionsForItem_skipsNonSubstantiveContent() {
        NeuronResponse shortNeuron = testDataFactory.createNeuron("Short", brainId, clusterId);
        SpacedRepetitionItemResponse srItem = srService.addItem(shortNeuron.id());

        reviewQuestionService.generateQuestionsForItem(srItem.id());

        assertThat(reviewQuestionService.getQuestionsForItem(srItem.id())).isEmpty();
    }

    @Test
    void hasReadyQuestions_returnsFalseWhenNoQuestions() {
        SpacedRepetitionItemResponse srItem = srService.addItem(neuronId);
        assertThat(reviewQuestionService.hasReadyQuestions(srItem.id())).isFalse();
    }

    @Test
    void hasReadyQuestions_returnsTrueAfterGeneration() {
        when(intelligenceService.generateReviewQA(anyString(), anyString(), anyInt(), anyString(), any()))
                .thenReturn(Map.of(
                        "items", List.of(
                                Map.of("question", "Q1?", "answer", "A1")
                        )
                ));

        SpacedRepetitionItemResponse srItem = srService.addItem(neuronId);
        reviewQuestionService.generateQuestionsForItem(srItem.id());

        assertThat(reviewQuestionService.hasReadyQuestions(srItem.id())).isTrue();
    }

    @Test
    void markStaleByNeuron_marksQuestionsAsStale() {
        when(intelligenceService.generateReviewQA(anyString(), anyString(), anyInt(), anyString(), any()))
                .thenReturn(Map.of(
                        "items", List.of(
                                Map.of("question", "Q1?", "answer", "A1")
                        )
                ));

        SpacedRepetitionItemResponse srItem = srService.addItem(neuronId);
        reviewQuestionService.generateQuestionsForItem(srItem.id());

        assertThat(reviewQuestionService.hasReadyQuestions(srItem.id())).isTrue();

        // Mark stale with different hash
        reviewQuestionService.markStaleByNeuron(neuronId, "different-hash");

        // READY questions should no longer exist
        assertThat(reviewQuestionService.hasReadyQuestions(srItem.id())).isFalse();
    }

}
