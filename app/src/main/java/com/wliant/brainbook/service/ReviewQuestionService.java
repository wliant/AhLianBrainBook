package com.wliant.brainbook.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.wliant.brainbook.dto.ReviewChoice;
import com.wliant.brainbook.dto.ReviewQuestionResponse;
import com.wliant.brainbook.exception.ResourceNotFoundException;
import com.wliant.brainbook.model.Neuron;
import com.wliant.brainbook.model.ReviewQuestion;
import com.wliant.brainbook.model.ReviewQuestionStatus;
import com.wliant.brainbook.model.ReviewQuestionType;
import com.wliant.brainbook.model.SpacedRepetitionItem;
import com.wliant.brainbook.model.Brain;
import com.wliant.brainbook.repository.BrainRepository;
import com.wliant.brainbook.repository.NeuronRepository;
import com.wliant.brainbook.repository.ReviewQuestionRepository;
import com.wliant.brainbook.repository.SpacedRepetitionRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;

@Service
@Transactional
public class ReviewQuestionService {

    private static final Logger log = LoggerFactory.getLogger(ReviewQuestionService.class);
    private static final int MIN_CONTENT_LENGTH = 100;
    private static final Set<String> TEXT_BEARING_SECTION_TYPES = Set.of(
            "rich-text", "code", "math", "callout", "table");
    private static final int CHOICES_PAYLOAD_VERSION = 1;
    private static final int MIN_CHOICE_OPTIONS = 2;
    private static final String CORRECT_ANSWER_JOINER = "; ";

    private final ReviewQuestionRepository reviewQuestionRepository;
    private final SpacedRepetitionRepository srRepository;
    private final NeuronRepository neuronRepository;
    private final BrainRepository brainRepository;
    private final IntelligenceService intelligenceService;
    private final TagService tagService;
    private final ObjectMapper objectMapper;
    private final TransactionTemplate transactionTemplate;

    public ReviewQuestionService(ReviewQuestionRepository reviewQuestionRepository,
                                  SpacedRepetitionRepository srRepository,
                                  NeuronRepository neuronRepository,
                                  BrainRepository brainRepository,
                                  IntelligenceService intelligenceService,
                                  TagService tagService,
                                  ObjectMapper objectMapper,
                                  TransactionTemplate transactionTemplate) {
        this.reviewQuestionRepository = reviewQuestionRepository;
        this.srRepository = srRepository;
        this.neuronRepository = neuronRepository;
        this.brainRepository = brainRepository;
        this.intelligenceService = intelligenceService;
        this.tagService = tagService;
        this.objectMapper = objectMapper;
        this.transactionTemplate = transactionTemplate;
    }

    private record GenerationContext(
            UUID srItemId, UUID neuronId, String neuronTitle, String contentText,
            int questionCount, String brainName, List<String> tags, String contentHash,
            boolean choiceQuestionsEnabled) {}

    /** A generated question after type/choice normalization, ready to persist. */
    private record NormalizedQuestion(
            String questionText, String answerText, ReviewQuestionType questionType,
            String choicesJson, String explanation, boolean researched) {}

    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    public void generateQuestionsForItem(UUID srItemId) {
        // Phase 1: Read data in a short transaction
        GenerationContext ctx = transactionTemplate.execute(status -> {
            SpacedRepetitionItem item = srRepository.findById(srItemId)
                    .orElseThrow(() -> new ResourceNotFoundException("SR item not found: " + srItemId));
            Neuron neuron = neuronRepository.findById(item.getNeuronId())
                    .orElseThrow(() -> new ResourceNotFoundException("Neuron not found: " + item.getNeuronId()));
            if (!isSubstantiveContent(neuron)) {
                log.debug("Neuron {} has insufficient content for quiz generation", item.getNeuronId());
                return null;
            }

            String contentHash = computeContentHash(neuron.getContentText());

            List<ReviewQuestion> existing = reviewQuestionRepository
                    .findBySrItemIdAndStatusOrderByQuestionOrder(item.getId(), ReviewQuestionStatus.READY);
            if (!existing.isEmpty() && contentHash.equals(existing.getFirst().getContentHash())) {
                log.debug("Questions for SR item {} are up-to-date, skipping generation", item.getId());
                return null;
            }

            String brainName = neuron.getBrainId() != null
                    ? brainRepository.findById(neuron.getBrainId()).map(Brain::getName).orElse("")
                    : "";
            List<String> tags = tagService.getTagsForNeuron(neuron.getId()).stream()
                    .map(t -> t.name())
                    .toList();

            return new GenerationContext(
                    item.getId(), neuron.getId(), neuron.getTitle(), neuron.getContentText(),
                    item.getQuestionCount(), brainName, tags, contentHash,
                    item.isChoiceQuestionsEnabled());
        });

        if (ctx == null) return;

        // Phase 2: Call intelligence service — NO transaction held
        Map<String, Object> response;
        try {
            response = intelligenceService.generateReviewQA(
                    ctx.neuronTitle(), ctx.contentText(), ctx.questionCount(), ctx.brainName(), ctx.tags(),
                    ctx.choiceQuestionsEnabled());
        } catch (Exception e) {
            log.error("Failed to generate review Q&A for neuron {}: {}", ctx.neuronId(), e.getMessage());
            return;
        }

        if (response == null) {
            log.warn("No response from intelligence service for neuron {}", ctx.neuronId());
            return;
        }

        String error = (String) response.get("error");
        if (error != null) {
            log.warn("Intelligence service returned error for neuron {}: {}", ctx.neuronId(), error);
            return;
        }

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> items = (List<Map<String, Object>>) response.get("items");
        if (items == null || items.isEmpty()) {
            log.warn("No questions generated for neuron {}", ctx.neuronId());
            return;
        }

        List<NormalizedQuestion> normalized = items.stream()
                .map(this::normalizeGeneratedItem)
                .filter(Objects::nonNull)
                .toList();
        if (normalized.isEmpty()) {
            log.warn("No usable questions generated for neuron {}", ctx.neuronId());
            return;
        }

        // Phase 3: Write results in a short transaction
        transactionTemplate.executeWithoutResult(status -> {
            reviewQuestionRepository.deleteBySrItemId(ctx.srItemId());

            SpacedRepetitionItem freshItem = srRepository.findById(ctx.srItemId()).orElse(null);
            Neuron freshNeuron = neuronRepository.findById(ctx.neuronId()).orElse(null);
            if (freshItem == null || freshNeuron == null) return;

            for (int i = 0; i < normalized.size(); i++) {
                NormalizedQuestion qa = normalized.get(i);
                ReviewQuestion question = new ReviewQuestion();
                question.setSrItem(freshItem);
                question.setNeuron(freshNeuron);
                question.setQuestionText(qa.questionText());
                question.setAnswerText(qa.answerText());
                question.setQuestionOrder(i);
                question.setQuestionType(qa.questionType());
                question.setChoices(qa.choicesJson());
                question.setExplanation(qa.explanation());
                question.setContentHash(ctx.contentHash());
                question.setStatus(ReviewQuestionStatus.READY);
                reviewQuestionRepository.save(question);
            }
        });

        log.info("Generated {} review questions for neuron {} (SR item {})",
                normalized.size(), ctx.neuronId(), ctx.srItemId());
    }

    @Transactional(readOnly = true)
    public List<ReviewQuestionResponse> getQuestionsForItem(UUID srItemId) {
        return reviewQuestionRepository
                .findBySrItemIdAndStatusOrderByQuestionOrder(srItemId, ReviewQuestionStatus.READY)
                .stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public boolean hasReadyQuestions(UUID srItemId) {
        return reviewQuestionRepository.existsBySrItemIdAndStatus(srItemId, ReviewQuestionStatus.READY);
    }

    public void markStaleByNeuron(UUID neuronId, String currentContentHash) {
        int updated = reviewQuestionRepository.markStaleByNeuronId(neuronId, currentContentHash);
        if (updated > 0) {
            log.info("Marked {} review questions as STALE for neuron {}", updated, neuronId);
        }
    }

    public boolean isSubstantiveContent(Neuron neuron) {
        String contentText = neuron.getContentText();
        if (contentText == null || contentText.length() < MIN_CONTENT_LENGTH) {
            return false;
        }

        String contentJson = neuron.getContentJson();
        if (contentJson == null || contentJson.isBlank()) {
            return false;
        }

        try {
            JsonNode root = objectMapper.readTree(contentJson);
            JsonNode sections = root.get("sections");
            if (sections == null || !sections.isArray()) {
                return false;
            }
            for (JsonNode section : sections) {
                String type = section.has("type") ? section.get("type").asText() : "";
                if (TEXT_BEARING_SECTION_TYPES.contains(type)) {
                    return true;
                }
            }
        } catch (Exception e) {
            log.warn("Failed to parse contentJson for neuron {}", neuron.getId(), e);
        }

        return false;
    }

    public String computeContentHash(String contentText) {
        if (contentText == null) return "";
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(contentText.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hash);
        } catch (NoSuchAlgorithmException e) {
            throw new RuntimeException("SHA-256 not available", e);
        }
    }


    /**
     * Turns one raw agent item into a persistable question.
     *
     * <p>The agent contract is {@code {question, answer, type?, choices?, correct_ids?, explanation?}}.
     * Anything unrecognised or structurally invalid degrades to {@link ReviewQuestionType#FREE_TEXT}
     * rather than being dropped, so a flaky agent response still yields a usable quiz and
     * pre-choices rows keep their original meaning.
     *
     * @return null only when the item has no question or answer text at all
     */
    private NormalizedQuestion normalizeGeneratedItem(Map<String, Object> qa) {
        String questionText = asText(qa.get("question"));
        if (questionText == null || questionText.isBlank()) {
            return null;
        }
        String answerText = asText(qa.get("answer"));
        String explanation = asText(qa.get("explanation"));

        // The agent sends snake_case "question_type"; "type" is accepted as a fallback.
        Object rawType = qa.get("question_type") != null ? qa.get("question_type") : qa.get("type");
        ReviewQuestionType requestedType = parseQuestionType(rawType);
        List<ReviewChoice> options = requestedType == ReviewQuestionType.FREE_TEXT
                ? List.of()
                : extractChoices(qa);

        if (options.size() < MIN_CHOICE_OPTIONS) {
            return freeTextOrNull(questionText, answerText, explanation);
        }

        long correctCount = options.stream().filter(ReviewChoice::correct).count();
        if (correctCount == 0 || correctCount == options.size()) {
            // Nothing to discriminate between — unusable as a choice question.
            log.debug("Choice question has {}/{} correct options; downgrading to free text",
                    correctCount, options.size());
            return freeTextOrNull(questionText, answerText, explanation);
        }

        // Trust the option flags over the declared type: they are what grading uses.
        ReviewQuestionType type = correctCount == 1
                ? ReviewQuestionType.SINGLE_CHOICE
                : ReviewQuestionType.MULTI_CHOICE;

        String derivedAnswer = options.stream()
                .filter(ReviewChoice::correct)
                .map(ReviewChoice::text)
                .reduce((a, b) -> a + CORRECT_ANSWER_JOINER + b)
                .orElse(answerText);

        boolean researched = isTruthy(qa.get("researched"))
                || options.stream().anyMatch(o -> o.sourceUrl() != null && !o.sourceUrl().isBlank());
        return new NormalizedQuestion(questionText, derivedAnswer, type,
                toChoicesJson(options, researched), explanation, researched);
    }

    /** answer_text is NOT NULL, so a question with no answer cannot be stored at all. */
    private NormalizedQuestion freeTextOrNull(String questionText, String answerText, String explanation) {
        if (answerText == null || answerText.isBlank()) {
            return null;
        }
        return new NormalizedQuestion(questionText, answerText, ReviewQuestionType.FREE_TEXT, null, explanation, false);
    }

    private ReviewQuestionType parseQuestionType(Object raw) {
        String value = asText(raw);
        if (value == null || value.isBlank()) {
            return ReviewQuestionType.FREE_TEXT;
        }
        try {
            return ReviewQuestionType.valueOf(value.trim().toUpperCase(java.util.Locale.ROOT));
        } catch (IllegalArgumentException e) {
            log.debug("Unknown review question type '{}', treating as free text", value);
            return ReviewQuestionType.FREE_TEXT;
        }
    }

    /**
     * Reads the agent's option list. An option counts as correct when its own {@code correct}
     * flag is set or its id appears in the item-level {@code correct_ids} list — the agent may
     * use either shape.
     */
    private List<ReviewChoice> extractChoices(Map<String, Object> qa) {
        Object raw = qa.get("choices");
        if (!(raw instanceof List<?> rawOptions) || rawOptions.isEmpty()) {
            return List.of();
        }

        Set<String> correctIds = new java.util.HashSet<>();
        if (qa.get("correct_ids") instanceof List<?> ids) {
            for (Object id : ids) {
                String text = asText(id);
                if (text != null) correctIds.add(text);
            }
        }

        List<ReviewChoice> options = new ArrayList<>();
        Set<String> seenIds = new java.util.HashSet<>();
        for (Object element : rawOptions) {
            if (!(element instanceof Map<?, ?> option)) continue;
            String text = asText(option.get("text"));
            if (text == null || text.isBlank()) continue;

            String id = asText(option.get("id"));
            if (id == null || id.isBlank() || !seenIds.add(id)) {
                // Ids are what the client submits back, so they must exist and be unique.
                id = "o" + (options.size() + 1);
                seenIds.add(id);
            }
            boolean correct = isTruthy(option.get("correct")) || correctIds.contains(id);
            options.add(new ReviewChoice(id, text, correct,
                    asText(option.get("rationale")),
                    asText(option.get("source_url")) != null
                            ? asText(option.get("source_url"))
                            : asText(option.get("sourceUrl"))));
        }
        return options;
    }

    private String toChoicesJson(List<ReviewChoice> options, boolean researched) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("version", CHOICES_PAYLOAD_VERSION);
        // Provenance: whether web research actually backed these distractors. The UI badges
        // it so a degraded (LLM-only) generation is visible rather than silent.
        payload.put("researched", researched);
        payload.put("options", options);
        try {
            return objectMapper.writeValueAsString(payload);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Failed to serialize review question choices", e);
        }
    }

    /** Parses stored choices back for the API. A bad row renders as free text instead of failing the queue. */
    private List<ReviewChoice> parseChoicesJson(String json) {
        if (json == null || json.isBlank()) {
            return null;
        }
        try {
            Map<String, Object> payload = objectMapper.readValue(json, new TypeReference<>() {});
            Object options = payload.get("options");
            if (options == null) return null;
            return objectMapper.convertValue(options, new TypeReference<List<ReviewChoice>>() {});
        } catch (Exception e) {
            log.warn("Failed to parse review question choices JSON", e);
            return null;
        }
    }

    private boolean isResearched(String json) {
        if (json == null || json.isBlank()) return false;
        try {
            JsonNode root = objectMapper.readTree(json);
            return root.path("researched").asBoolean(false);
        } catch (Exception e) {
            return false;
        }
    }

    private static String asText(Object value) {
        return value == null ? null : String.valueOf(value);
    }

    private static boolean isTruthy(Object value) {
        if (value instanceof Boolean b) return b;
        return value != null && Boolean.parseBoolean(String.valueOf(value));
    }

    private ReviewQuestionResponse toResponse(ReviewQuestion q) {
        ReviewQuestionType type = q.getQuestionType() != null
                ? q.getQuestionType()
                : ReviewQuestionType.FREE_TEXT;
        List<ReviewChoice> choices = type == ReviewQuestionType.FREE_TEXT
                ? null
                : parseChoicesJson(q.getChoices());
        // An unparseable payload leaves nothing to select, so present it as free text.
        if (type != ReviewQuestionType.FREE_TEXT && (choices == null || choices.isEmpty())) {
            type = ReviewQuestionType.FREE_TEXT;
            choices = null;
        }
        return new ReviewQuestionResponse(q.getId(), q.getQuestionText(), q.getAnswerText(),
                q.getQuestionOrder(), type, choices, q.getExplanation(),
                type != ReviewQuestionType.FREE_TEXT && isResearched(q.getChoices()));
    }
}
