package com.wliant.brainbook.service;

import com.wliant.brainbook.config.DatabaseCleaner;
import com.wliant.brainbook.config.TestContainersConfig;
import com.wliant.brainbook.dto.NeuronContentRequest;
import com.wliant.brainbook.dto.NeuronResponse;
import com.wliant.brainbook.dto.ReviewChoice;
import com.wliant.brainbook.dto.ReviewQuestionResponse;
import com.wliant.brainbook.dto.SpacedRepetitionItemResponse;
import com.wliant.brainbook.config.TestDataFactory;
import com.wliant.brainbook.model.Neuron;
import com.wliant.brainbook.model.ReviewQuestionType;
import com.wliant.brainbook.repository.NeuronRepository;
import io.minio.MinioClient;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
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

        // The content update schedules async embedding work that calls the mocked
        // IntelligenceService. Let it finish before any test stubs that same mock —
        // a concurrent call during when(...) makes Mockito bind the stub to the wrong method.
        databaseCleaner.drainAsyncTasks();
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
        when(intelligenceService.generateReviewQA(anyString(), anyString(), anyInt(), anyString(), any(), anyBoolean()))
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
        when(intelligenceService.generateReviewQA(anyString(), anyString(), anyInt(), anyString(), any(), anyBoolean()))
                .thenReturn(Map.of(
                        "items", List.of(
                                Map.of("question", "Q1?", "answer", "A1")
                        )
                ));

        SpacedRepetitionItemResponse srItem = srService.addItem(neuronId);
        reviewQuestionService.generateQuestionsForItem(srItem.id());

        assertThat(reviewQuestionService.hasReadyQuestions(srItem.id())).isTrue();
    }

    // ----------------------------------------------------------------- choice questions

    /** Builds one agent option in the shape the intelligence service returns. */
    private static Map<String, Object> option(String id, String text, boolean correct, String sourceUrl) {
        Map<String, Object> o = new HashMap<>();
        o.put("id", id);
        o.put("text", text);
        o.put("correct", correct);
        o.put("rationale", "because " + text);
        o.put("source_url", sourceUrl);
        return o;
    }

    private static Map<String, Object> choiceItem(String type, List<Map<String, Object>> options) {
        return choiceItem(type, "Dijkstra, because weights must be non-negative", options);
    }

    private static Map<String, Object> choiceItem(String type, String answer,
                                                  List<Map<String, Object>> options) {
        Map<String, Object> item = new HashMap<>();
        item.put("question", "Which algorithm needs non-negative weights?");
        item.put("answer", answer);
        item.put("question_type", type);
        item.put("choices", options);
        item.put("explanation", "Dijkstra settles vertices greedily.");
        return item;
    }

    private static List<Map<String, Object>> fourOptions() {
        return List.of(
                option("a", "Dijkstra", true, "https://example.com/dijkstra"),
                option("b", "Bellman-Ford", false, "https://example.com/bf"),
                option("c", "Floyd-Warshall", false, null),
                option("d", "Kruskal", false, null));
    }

    private void stub(List<Map<String, Object>> items) {
        when(intelligenceService.generateReviewQA(anyString(), anyString(), anyInt(), anyString(), any(), anyBoolean()))
                .thenReturn(Map.of("items", items));
    }

    private List<ReviewQuestionResponse> generate() {
        SpacedRepetitionItemResponse srItem = srService.addItem(neuronId);
        reviewQuestionService.generateQuestionsForItem(srItem.id());
        return reviewQuestionService.getQuestionsForItem(srItem.id());
    }

    @Test
    void generateQuestionsForItem_persistsSingleChoiceQuestion() {
        stub(List.of(choiceItem("single_choice", fourOptions())));

        List<ReviewQuestionResponse> questions = generate();

        assertThat(questions).hasSize(1);
        ReviewQuestionResponse q = questions.getFirst();
        assertThat(q.questionType()).isEqualTo(ReviewQuestionType.SINGLE_CHOICE);
        assertThat(q.choices()).hasSize(4);
        assertThat(q.choices()).extracting(ReviewChoice::id).containsExactly("a", "b", "c", "d");
        assertThat(q.choices()).filteredOn(ReviewChoice::correct).hasSize(1);
        assertThat(q.explanation()).isEqualTo("Dijkstra settles vertices greedily.");
    }

    @Test
    void generateQuestionsForItem_derivesAnswerTextFromTheCorrectOption() {
        stub(List.of(choiceItem("single_choice", fourOptions())));

        // answer_text is NOT NULL and is what the "Correct Answer" panel shows. The correct
        // option wins over whatever the agent put in "answer", so the two can never disagree.
        assertThat(generate().getFirst().answerText()).isEqualTo("Dijkstra");
    }

    @Test
    void generateQuestionsForItem_joinsEveryCorrectOptionForMultiSelect() {
        stub(List.of(choiceItem("multi_choice", List.of(
                option("a", "Atomicity", true, null),
                option("b", "Isolation", true, null),
                option("c", "Elasticity", false, null),
                option("d", "Affinity", false, null)))));

        List<ReviewQuestionResponse> questions = generate();
        assertThat(questions.getFirst().questionType()).isEqualTo(ReviewQuestionType.MULTI_CHOICE);
        assertThat(questions.getFirst().answerText()).isEqualTo("Atomicity; Isolation");
    }

    @Test
    void generateQuestionsForItem_preservesRationaleAndSourceUrl() {
        stub(List.of(choiceItem("single_choice", fourOptions())));

        ReviewChoice distractor = generate().getFirst().choices().stream()
                .filter(c -> c.id().equals("b")).findFirst().orElseThrow();
        assertThat(distractor.rationale()).isEqualTo("because Bellman-Ford");
        assertThat(distractor.sourceUrl()).isEqualTo("https://example.com/bf");
    }

    @Test
    void generateQuestionsForItem_flagsResearchedWhenADistractorHasASource() {
        stub(List.of(choiceItem("single_choice", fourOptions())));
        assertThat(generate().getFirst().researched()).isTrue();
    }

    @Test
    void generateQuestionsForItem_doesNotFlagResearchedWithoutSources() {
        stub(List.of(choiceItem("single_choice", List.of(
                option("a", "Dijkstra", true, null),
                option("b", "Bellman-Ford", false, null),
                option("c", "Floyd-Warshall", false, null)))));
        assertThat(generate().getFirst().researched()).isFalse();
    }

    @Test
    void generateQuestionsForItem_promotesToMultiChoiceWhenSeveralOptionsAreCorrect() {
        // The option flags are what grading uses, so they win over the declared type.
        stub(List.of(choiceItem("single_choice", List.of(
                option("a", "Dijkstra", true, null),
                option("b", "Bellman-Ford", true, null),
                option("c", "Floyd-Warshall", false, null)))));

        assertThat(generate().getFirst().questionType()).isEqualTo(ReviewQuestionType.MULTI_CHOICE);
    }

    @Test
    void generateQuestionsForItem_acceptsItemLevelCorrectIds() {
        Map<String, Object> item = choiceItem("single_choice", List.of(
                option("a", "Dijkstra", false, null),
                option("b", "Bellman-Ford", false, null),
                option("c", "Floyd-Warshall", false, null)));
        item.put("correct_ids", List.of("a"));
        stub(List.of(item));

        List<ReviewChoice> choices = generate().getFirst().choices();
        assertThat(choices).filteredOn(ReviewChoice::correct).extracting(ReviewChoice::id).containsExactly("a");
    }

    // --- degradation: a bad choice payload must never lose the question or 500 the queue

    @Test
    void generateQuestionsForItem_downgradesWhenNoOptionIsCorrect() {
        stub(List.of(choiceItem("single_choice", List.of(
                option("a", "Dijkstra", false, null),
                option("b", "Bellman-Ford", false, null),
                option("c", "Floyd", false, null)))));

        ReviewQuestionResponse q = generate().getFirst();
        assertThat(q.questionType()).isEqualTo(ReviewQuestionType.FREE_TEXT);
        assertThat(q.choices()).isNull();
    }

    @Test
    void generateQuestionsForItem_downgradesWhenEveryOptionIsCorrect() {
        stub(List.of(choiceItem("single_choice", List.of(
                option("a", "Dijkstra", true, null),
                option("b", "Bellman-Ford", true, null),
                option("c", "Floyd", true, null)))));

        assertThat(generate().getFirst().questionType()).isEqualTo(ReviewQuestionType.FREE_TEXT);
    }

    @Test
    void generateQuestionsForItem_downgradesWhenThereIsOnlyOneOption() {
        stub(List.of(choiceItem("single_choice", List.of(option("a", "Dijkstra", true, null)))));
        assertThat(generate().getFirst().questionType()).isEqualTo(ReviewQuestionType.FREE_TEXT);
    }

    @Test
    void generateQuestionsForItem_acceptsTheLegacyTypeKey() {
        // The contract key is "question_type"; "type" is tolerated as a fallback.
        Map<String, Object> item = new HashMap<>();
        item.put("question", "Which algorithm needs non-negative weights?");
        item.put("answer", "Dijkstra");
        item.put("type", "single_choice");
        item.put("choices", fourOptions());
        stub(List.of(item));

        assertThat(generate().getFirst().questionType()).isEqualTo(ReviewQuestionType.SINGLE_CHOICE);
    }

    @Test
    void generateQuestionsForItem_downgradesOnAnUnknownQuestionType() {
        stub(List.of(choiceItem("true_false", fourOptions())));
        assertThat(generate().getFirst().questionType()).isEqualTo(ReviewQuestionType.FREE_TEXT);
    }

    @Test
    void generateQuestionsForItem_dropsADowngradedItemWithNoAnswerText() {
        // answer_text is NOT NULL, so a choice item that fails validation AND has no
        // answer cannot be stored at all.
        stub(List.of(choiceItem("single_choice", "", List.of(option("a", "Dijkstra", true, null)))));
        assertThat(generate()).isEmpty();
    }

    @Test
    void generateQuestionsForItem_treatsLegacyItemsAsFreeText() {
        stub(List.of(Map.of("question", "What is DI?", "answer", "Dependency injection.")));

        ReviewQuestionResponse q = generate().getFirst();
        assertThat(q.questionType()).isEqualTo(ReviewQuestionType.FREE_TEXT);
        assertThat(q.choices()).isNull();
        assertThat(q.researched()).isFalse();
        assertThat(q.answerText()).isEqualTo("Dependency injection.");
    }

    @Test
    void generateQuestionsForItem_mixesChoiceAndFreeTextInOneSet() {
        stub(List.of(
                choiceItem("single_choice", fourOptions()),
                Map.of("question", "Why non-negative?", "answer", "The greedy choice must stay valid.")));

        List<ReviewQuestionResponse> questions = generate();
        assertThat(questions).extracting(ReviewQuestionResponse::questionType)
                .containsExactly(ReviewQuestionType.SINGLE_CHOICE, ReviewQuestionType.FREE_TEXT);
    }

    @Test
    void generateQuestionsForItem_forwardsTheChoiceQuestionsFlag() {
        stub(List.of(choiceItem("single_choice", fourOptions())));
        SpacedRepetitionItemResponse srItem = srService.addItem(neuronId);
        srService.updateChoiceQuestionsEnabled(srItem.id(), false);

        reviewQuestionService.generateQuestionsForItem(srItem.id());

        verify(intelligenceService).generateReviewQA(
                anyString(), anyString(), anyInt(), anyString(), any(), eq(false));
    }

    @Test
    void markStaleByNeuron_marksQuestionsAsStale() {
        when(intelligenceService.generateReviewQA(anyString(), anyString(), anyInt(), anyString(), any(), anyBoolean()))
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

    @Test
    void generateQuestionsForItem_skipsWhenContentUnchangedAndReadyExists() {
        when(intelligenceService.generateReviewQA(anyString(), anyString(), anyInt(), anyString(), any(), anyBoolean()))
                .thenReturn(Map.of("items", List.of(Map.of("question", "Original Q?", "answer", "Original A"))))
                .thenReturn(Map.of("items", List.of(Map.of("question", "Fresh Q?", "answer", "Fresh A"))));

        SpacedRepetitionItemResponse srItem = srService.addItem(neuronId);
        reviewQuestionService.generateQuestionsForItem(srItem.id());

        // Second call without marking stale is a no-op: the content hash still matches READY questions.
        reviewQuestionService.generateQuestionsForItem(srItem.id());

        List<ReviewQuestionResponse> questions = reviewQuestionService.getQuestionsForItem(srItem.id());
        assertThat(questions).hasSize(1);
        assertThat(questions.get(0).questionText()).isEqualTo("Original Q?");
    }

    @Test
    void regenerate_replacesQuestionsEvenWhenContentUnchanged() {
        when(intelligenceService.generateReviewQA(anyString(), anyString(), anyInt(), anyString(), any(), anyBoolean()))
                .thenReturn(Map.of("items", List.of(Map.of("question", "Original Q?", "answer", "Original A"))))
                .thenReturn(Map.of("items", List.of(
                        Map.of("question", "Fresh Q1?", "answer", "Fresh A1"),
                        Map.of("question", "Fresh Q2?", "answer", "Fresh A2"))));

        SpacedRepetitionItemResponse srItem = srService.addItem(neuronId);
        reviewQuestionService.generateQuestionsForItem(srItem.id());
        assertThat(reviewQuestionService.getQuestionsForItem(srItem.id())).hasSize(1);

        // This is exactly what ReviewQuestionAsyncService.regenerateForItem does: mark stale then generate.
        // markStaleByNeuron with an empty hash clears the READY status so the idempotency guard does not skip.
        reviewQuestionService.markStaleByNeuron(neuronId, "");
        reviewQuestionService.generateQuestionsForItem(srItem.id());

        List<ReviewQuestionResponse> regenerated = reviewQuestionService.getQuestionsForItem(srItem.id());
        assertThat(regenerated).hasSize(2);
        assertThat(regenerated.get(0).questionText()).isEqualTo("Fresh Q1?");
        assertThat(regenerated.get(1).questionText()).isEqualTo("Fresh Q2?");
    }

}
