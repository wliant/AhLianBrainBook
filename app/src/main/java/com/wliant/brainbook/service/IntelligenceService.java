package com.wliant.brainbook.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.wliant.brainbook.dto.AiAssistRequest;
import com.wliant.brainbook.dto.AiAssistResponse;
import com.wliant.brainbook.exception.ResourceNotFoundException;
import com.wliant.brainbook.model.Brain;
import com.wliant.brainbook.model.Cluster;
import com.wliant.brainbook.model.Neuron;
import com.wliant.brainbook.repository.BrainRepository;
import com.wliant.brainbook.repository.ClusterRepository;
import com.wliant.brainbook.repository.NeuronRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestClientResponseException;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
public class IntelligenceService {

    private static final Logger logger = LoggerFactory.getLogger(IntelligenceService.class);

    private final NeuronRepository neuronRepository;
    private final BrainRepository brainRepository;
    private final ClusterRepository clusterRepository;
    private final TagService tagService;
    private final RestClient intelligenceRestClient;
    private final ObjectMapper objectMapper;

    public IntelligenceService(NeuronRepository neuronRepository,
                               BrainRepository brainRepository,
                               ClusterRepository clusterRepository,
                               TagService tagService,
                               RestClient intelligenceRestClient,
                               ObjectMapper objectMapper) {
        this.neuronRepository = neuronRepository;
        this.brainRepository = brainRepository;
        this.clusterRepository = clusterRepository;
        this.tagService = tagService;
        this.intelligenceRestClient = intelligenceRestClient;
        this.objectMapper = objectMapper;
    }

    public AiAssistResponse aiAssist(UUID neuronId, String sectionId, AiAssistRequest request) {
        Neuron neuron = neuronRepository.findById(neuronId)
                .orElseThrow(() -> new ResourceNotFoundException("Neuron not found: " + neuronId));

        Brain brain = brainRepository.findById(neuron.getBrainId())
                .orElseThrow(() -> new ResourceNotFoundException("Brain not found: " + neuron.getBrainId()));

        String clusterName = null;
        if (neuron.getClusterId() != null) {
            clusterName = clusterRepository.findById(neuron.getClusterId())
                    .map(Cluster::getName)
                    .orElse(null);
        }

        List<String> tagNames = tagService.getTagsForNeuron(neuronId).stream()
                .map(t -> t.name())
                .toList();

        List<Map<String, Object>> siblingsSummary = extractSiblingSummaries(
                neuron.getContentJson(), sectionId);

        // Build context
        Map<String, Object> context = new HashMap<>();
        context.put("neuron_id", neuronId.toString());
        context.put("neuron_title", neuron.getTitle() != null ? neuron.getTitle() : "Untitled");
        context.put("section_id", sectionId);
        context.put("brain_name", brain.getName());
        context.put("cluster_name", clusterName);
        context.put("tags", tagNames);
        context.put("sibling_sections_summary", siblingsSummary);

        // Build enriched request for intelligence service
        Map<String, Object> enrichedRequest = new HashMap<>();
        enrichedRequest.put("section_type", request.sectionType());
        enrichedRequest.put("current_content", request.currentContent());
        enrichedRequest.put("user_message", request.userMessage() != null ? request.userMessage() : "");
        enrichedRequest.put("conversation_history", request.conversationHistory() != null
                ? request.conversationHistory() : List.of());
        // Convert questionAnswers from camelCase to snake_case for Python service
        if (request.questionAnswers() != null) {
            List<Map<String, Object>> snakeAnswers = request.questionAnswers().stream()
                    .map(qa -> {
                        Map<String, Object> m = new HashMap<>();
                        m.put("question_id", qa.questionId());
                        m.put("value", qa.value());
                        return m;
                    })
                    .toList();
            enrichedRequest.put("question_answers", snakeAnswers);
        } else {
            enrichedRequest.put("question_answers", null);
        }
        enrichedRequest.put("regenerate", request.regenerate());
        enrichedRequest.put("context", context);

        // Call intelligence service
        Map<String, Object> agentResponse;
        try {
            agentResponse = callIntelligenceService(enrichedRequest);
        } catch (RestClientResponseException e) {
            logger.error("Intelligence service returned error: {} {}", e.getStatusCode(), e.getResponseBodyAsString(), e);
            return buildErrorResponse(
                    "AI service error: " + e.getStatusText(),
                    request.conversationHistory()
            );
        } catch (RestClientException e) {
            logger.error("Failed to connect to intelligence service", e);
            return buildErrorResponse(
                    "Cannot connect to the AI service. Please ensure it is running.",
                    request.conversationHistory()
            );
        }

        if (agentResponse == null) {
            return buildErrorResponse(
                    "No response from the AI service.",
                    request.conversationHistory()
            );
        }

        // Build conversation history with new turns
        List<AiAssistRequest.ConversationTurn> updatedHistory = new ArrayList<>(
                request.conversationHistory() != null ? request.conversationHistory() : List.of()
        );

        // Add user turn
        Map<String, Object> userContent;
        if (request.questionAnswers() != null && !request.questionAnswers().isEmpty()) {
            userContent = Map.of("type", "answers", "answers", request.questionAnswers());
        } else if (request.regenerate()) {
            userContent = Map.of("type", "text", "text", "[Regenerate]");
        } else {
            userContent = Map.of("type", "text", "text",
                    request.userMessage() != null ? request.userMessage() : "");
        }
        updatedHistory.add(new AiAssistRequest.ConversationTurn("user", userContent));

        // Add assistant turn
        String responseType = (String) agentResponse.getOrDefault("response_type", "message");
        Map<String, Object> assistantContent = buildAssistantContent(responseType, agentResponse);
        updatedHistory.add(new AiAssistRequest.ConversationTurn("assistant", assistantContent));

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> questions = (List<Map<String, Object>>) agentResponse.get("questions");
        @SuppressWarnings("unchecked")
        Map<String, Object> sectionContent = (Map<String, Object>) agentResponse.get("section_content");

        List<AiAssistResponse.QuestionItem> questionItems = null;
        if (questions != null) {
            questionItems = questions.stream()
                    .map(q -> new AiAssistResponse.QuestionItem(
                            (String) q.get("id"),
                            (String) q.get("text"),
                            (String) q.get("input_type"),
                            q.get("options") != null ? ((List<?>) q.get("options")).stream()
                                    .map(Object::toString).toList() : null,
                            q.get("required") == null || (boolean) q.get("required")
                    ))
                    .toList();
        }

        return new AiAssistResponse(
                responseType,
                questionItems,
                sectionContent,
                (String) agentResponse.get("message"),
                (String) agentResponse.get("message_severity"),
                (String) agentResponse.get("explanation"),
                updatedHistory
        );
    }

    public String generateResearchGoal(String brainName, List<Map<String, Object>> neuronSummaries) {
        Map<String, Object> request = Map.of(
                "brain_name", brainName,
                "neurons", neuronSummaries
        );
        Map<String, Object> response = callAgent("/api/agents/research-goal-generator", request);
        return response != null ? (String) response.getOrDefault("research_goal", "") : "";
    }

    public Map<String, Object> generateResearchTopic(String prompt, String researchGoal,
                                                      String brainName, List<Map<String, Object>> neuronSummaries) {
        Map<String, Object> context = Map.of(
                "brain_name", brainName,
                "research_goal", researchGoal != null ? researchGoal : "",
                "neurons", neuronSummaries
        );
        Map<String, Object> request = Map.of("prompt", prompt, "context", context);
        return callAgent("/api/agents/research-topic-generator", request);
    }

    public Map<String, Object> scoreResearchTopic(List<Map<String, Object>> items, String researchGoal,
                                                    String brainName, List<Map<String, Object>> neuronSummaries) {
        Map<String, Object> context = Map.of(
                "brain_name", brainName,
                "research_goal", researchGoal != null ? researchGoal : "",
                "neurons", neuronSummaries
        );
        Map<String, Object> request = Map.of("items", items, "context", context);
        return callAgent("/api/agents/research-topic-scorer", request);
    }

    public Map<String, Object> expandBullet(Map<String, Object> bullet, String parentContext,
                                             String researchGoal, String brainName,
                                             List<Map<String, Object>> neuronSummaries) {
        Map<String, Object> context = Map.of(
                "brain_name", brainName,
                "research_goal", researchGoal != null ? researchGoal : "",
                "neurons", neuronSummaries
        );
        Map<String, Object> request = Map.of(
                "bullet", bullet,
                "parent_context", parentContext != null ? parentContext : "",
                "context", context
        );
        return callAgent("/api/agents/research-bullet-expander", request);
    }

    public Map<String, Object> generateReviewQA(String neuronTitle, String contentText,
                                                int questionCount, String brainName, List<String> tags) {
        Map<String, Object> request = Map.of(
                "neuron_title", neuronTitle != null ? neuronTitle : "Untitled",
                "content_text", contentText != null ? contentText : "",
                "question_count", questionCount,
                "brain_name", brainName != null ? brainName : "",
                "tags", tags != null ? tags : List.of()
        );
        return callAgent("/api/agents/review-qa-generator", request);
    }

    Map<String, Object> callAgent(String uri, Map<String, Object> request) {
        return intelligenceRestClient.post()
                .uri(uri)
                .contentType(MediaType.APPLICATION_JSON)
                .body(request)
                .retrieve()
                .body(new ParameterizedTypeReference<>() {
                });
    }

    Map<String, Object> callIntelligenceService(Map<String, Object> request) {
        return callAgent("/api/agents/section-author", request);
    }

    private Map<String, Object> buildAssistantContent(String responseType, Map<String, Object> agentResponse) {
        return switch (responseType) {
            case "questions" -> {
                Map<String, Object> c = new HashMap<>();
                c.put("type", "questions");
                // Normalize snake_case keys to camelCase for frontend
                @SuppressWarnings("unchecked")
                List<Map<String, Object>> rawQuestions = (List<Map<String, Object>>) agentResponse.get("questions");
                if (rawQuestions != null) {
                    List<Map<String, Object>> normalized = rawQuestions.stream()
                            .map(q -> {
                                Map<String, Object> nq = new HashMap<>(q);
                                if (nq.containsKey("input_type") && !nq.containsKey("inputType")) {
                                    nq.put("inputType", nq.remove("input_type"));
                                }
                                return nq;
                            })
                            .toList();
                    c.put("questions", normalized);
                } else {
                    c.put("questions", List.of());
                }
                yield c;
            }
            case "content" -> {
                Map<String, Object> c = new HashMap<>();
                c.put("type", "section_content");
                c.put("sectionContent", agentResponse.get("section_content"));
                yield c;
            }
            case "reply" -> {
                Map<String, Object> c = new HashMap<>();
                c.put("type", "reply");
                c.put("text", agentResponse.getOrDefault("message", ""));
                yield c;
            }
            default -> {
                Map<String, Object> c = new HashMap<>();
                c.put("type", "message");
                c.put("text", agentResponse.getOrDefault("message", ""));
                c.put("severity", agentResponse.getOrDefault("message_severity", "info"));
                yield c;
            }
        };
    }

    List<Map<String, Object>> extractSiblingSummaries(String contentJson, String excludeSectionId) {
        List<Map<String, Object>> summaries = new ArrayList<>();
        if (contentJson == null || contentJson.isBlank()) return summaries;

        try {
            JsonNode root = objectMapper.readTree(contentJson);
            JsonNode sections = root.get("sections");
            if (sections == null || !sections.isArray()) return summaries;

            for (JsonNode section : sections) {
                String sid = section.has("id") ? section.get("id").asText() : "";
                if (sid.equals(excludeSectionId)) continue;

                String type = section.has("type") ? section.get("type").asText() : "unknown";
                int order = section.has("order") ? section.get("order").asInt() : 0;
                String preview = extractSectionPreview(section, type);

                Map<String, Object> summary = new HashMap<>();
                summary.put("section_id", sid);
                summary.put("section_type", type);
                summary.put("order", order);
                summary.put("preview", preview);
                summaries.add(summary);
            }
        } catch (Exception e) {
            logger.warn("Failed to parse contentJson for sibling summaries", e);
        }

        return summaries;
    }

    private String extractSectionPreview(JsonNode section, String type) {
        JsonNode content = section.get("content");
        if (content == null) return "";

        String text = switch (type) {
            case "code" -> content.has("code") ? content.get("code").asText() : "";
            case "math" -> content.has("latex") ? content.get("latex").asText() : "";
            case "diagram" -> content.has("source") ? content.get("source").asText() : "";
            case "callout" -> content.has("text") ? content.get("text").asText() : "";
            case "table" -> {
                StringBuilder sb = new StringBuilder();
                if (content.has("headers")) {
                    for (JsonNode h : content.get("headers")) sb.append(h.asText()).append(" | ");
                }
                yield sb.toString();
            }
            case "rich-text" -> extractTiptapText(content);
            default -> "";
        };

        return text.length() > 200 ? text.substring(0, 200) : text;
    }

    private String extractTiptapText(JsonNode node) {
        if (node == null) return "";
        StringBuilder sb = new StringBuilder();
        if (node.has("text")) {
            sb.append(node.get("text").asText());
        }
        if (node.has("content") && node.get("content").isArray()) {
            for (JsonNode child : node.get("content")) {
                sb.append(extractTiptapText(child));
            }
        }
        return sb.toString();
    }

    private AiAssistResponse buildErrorResponse(String message,
                                                 List<AiAssistRequest.ConversationTurn> existingHistory) {
        List<AiAssistRequest.ConversationTurn> history = new ArrayList<>(
                existingHistory != null ? existingHistory : List.of()
        );
        history.add(new AiAssistRequest.ConversationTurn("assistant",
                Map.of("type", "message", "text", message, "severity", "error")));

        return new AiAssistResponse(
                "message",
                null,
                null,
                message,
                "error",
                null,
                history
        );
    }
}
