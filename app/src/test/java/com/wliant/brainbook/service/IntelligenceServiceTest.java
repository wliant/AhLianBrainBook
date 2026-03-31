package com.wliant.brainbook.service;

import com.wliant.brainbook.config.DatabaseCleaner;
import com.wliant.brainbook.config.TestContainersConfig;
import com.wliant.brainbook.config.TestDataFactory;
import com.wliant.brainbook.dto.AiAssistRequest;
import com.wliant.brainbook.dto.AiAssistResponse;
import com.wliant.brainbook.dto.BrainResponse;
import com.wliant.brainbook.dto.ClusterResponse;
import com.wliant.brainbook.dto.NeuronContentRequest;
import com.wliant.brainbook.dto.NeuronResponse;
import io.minio.MinioClient;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;
import org.springframework.web.client.RestClientException;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.doThrow;

@SpringBootTest
@Import(TestContainersConfig.class)
@ActiveProfiles("test")
class IntelligenceServiceTest {

    @MockitoBean
    private MinioClient minioClient;

    @MockitoSpyBean
    private IntelligenceService intelligenceService;

    @Autowired
    private NeuronService neuronService;

    @Autowired
    private DatabaseCleaner databaseCleaner;

    @Autowired
    private TestDataFactory testDataFactory;

    private NeuronResponse neuron;

    private static final String CONTENT_JSON = "{\"version\":2,\"sections\":[" +
            "{\"id\":\"s1\",\"type\":\"rich-text\",\"order\":0," +
            "\"content\":{\"type\":\"doc\",\"content\":[{\"type\":\"paragraph\",\"content\":[{\"type\":\"text\",\"text\":\"Hello world\"}]}]}," +
            "\"meta\":{}}," +
            "{\"id\":\"s2\",\"type\":\"code\",\"order\":1," +
            "\"content\":{\"code\":\"print('hi')\",\"language\":\"python\"}," +
            "\"meta\":{}}" +
            "]}";

    @BeforeEach
    void setUp() {
        databaseCleaner.clean();
        BrainResponse brain = testDataFactory.createBrain("AI Test Brain");
        ClusterResponse cluster = testDataFactory.createCluster("AI Test Cluster", brain.id());
        neuron = testDataFactory.createNeuron("Test Neuron", brain.id(), cluster.id());
        neuronService.updateContent(neuron.id(),
                new NeuronContentRequest(CONTENT_JSON, "Hello world print('hi')", neuron.version()));
    }

    @Test
    void aiAssist_enrichesContextWithNeuronData() {
        doReturn(Map.of(
                "response_type", "content",
                "section_content", Map.of("code", "# generated", "language", "python"),
                "explanation", "Generated code"
        )).when(intelligenceService).callIntelligenceService(any());

        AiAssistRequest request = new AiAssistRequest(
                "code",
                Map.of("code", "", "language", "javascript"),
                "Write a hello function",
                List.of(),
                null,
                false
        );

        AiAssistResponse response = intelligenceService.aiAssist(neuron.id(), "s2", request);

        assertThat(response.responseType()).isEqualTo("content");
        assertThat(response.sectionContent()).containsEntry("code", "# generated");
        assertThat(response.explanation()).isEqualTo("Generated code");
    }

    @Test
    void aiAssist_appendsConversationHistory() {
        doReturn(Map.of(
                "response_type", "questions",
                "questions", List.of(Map.of(
                        "id", "q1",
                        "text", "Which language?",
                        "input_type", "single-select",
                        "options", List.of("Python", "JS"),
                        "required", true
                )),
                "explanation", "Need clarification"
        )).when(intelligenceService).callIntelligenceService(any());

        AiAssistRequest request = new AiAssistRequest(
                "code", null, "Write code", List.of(), null, false
        );

        AiAssistResponse response = intelligenceService.aiAssist(neuron.id(), "s2", request);

        assertThat(response.responseType()).isEqualTo("questions");
        assertThat(response.questions()).hasSize(1);
        assertThat(response.questions().get(0).text()).isEqualTo("Which language?");
        assertThat(response.conversationHistory()).hasSize(2);
        assertThat(response.conversationHistory().get(0).role()).isEqualTo("user");
        assertThat(response.conversationHistory().get(1).role()).isEqualTo("assistant");
    }

    @Test
    void aiAssist_returnsErrorWhenIntelligenceServiceUnavailable() {
        doThrow(new RestClientException("Connection refused"))
                .when(intelligenceService).callIntelligenceService(any());

        AiAssistRequest request = new AiAssistRequest(
                "code", null, "Write code", List.of(), null, false
        );

        AiAssistResponse response = intelligenceService.aiAssist(neuron.id(), "s2", request);

        assertThat(response.responseType()).isEqualTo("message");
        assertThat(response.messageSeverity()).isEqualTo("error");
        assertThat(response.message()).contains("Cannot connect");
    }

    @Test
    void extractSiblingSummaries_parsesSectionsCorrectly() {
        List<Map<String, Object>> summaries = intelligenceService.extractSiblingSummaries(
                CONTENT_JSON, "s2");

        assertThat(summaries).hasSize(1);
        assertThat(summaries.get(0).get("section_id")).isEqualTo("s1");
        assertThat(summaries.get(0).get("section_type")).isEqualTo("rich-text");
        assertThat((String) summaries.get(0).get("preview")).contains("Hello world");
    }
}
