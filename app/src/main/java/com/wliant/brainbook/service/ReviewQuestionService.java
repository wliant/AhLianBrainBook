package com.wliant.brainbook.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.wliant.brainbook.dto.ReviewQuestionResponse;
import com.wliant.brainbook.exception.ResourceNotFoundException;
import com.wliant.brainbook.model.Neuron;
import com.wliant.brainbook.model.ReviewQuestion;
import com.wliant.brainbook.model.ReviewQuestionStatus;
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
import java.util.HexFormat;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

@Service
@Transactional
public class ReviewQuestionService {

    private static final Logger log = LoggerFactory.getLogger(ReviewQuestionService.class);
    private static final int MIN_CONTENT_LENGTH = 100;
    private static final Set<String> TEXT_BEARING_SECTION_TYPES = Set.of(
            "rich-text", "code", "math", "callout", "table");

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
            int questionCount, String brainName, List<String> tags, String contentHash) {}

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
                    item.getQuestionCount(), brainName, tags, contentHash);
        });

        if (ctx == null) return;

        // Phase 2: Call intelligence service — NO transaction held
        Map<String, Object> response;
        try {
            response = intelligenceService.generateReviewQA(
                    ctx.neuronTitle(), ctx.contentText(), ctx.questionCount(), ctx.brainName(), ctx.tags());
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

        // Phase 3: Write results in a short transaction
        transactionTemplate.executeWithoutResult(status -> {
            reviewQuestionRepository.deleteBySrItemId(ctx.srItemId());

            SpacedRepetitionItem freshItem = srRepository.findById(ctx.srItemId()).orElse(null);
            Neuron freshNeuron = neuronRepository.findById(ctx.neuronId()).orElse(null);
            if (freshItem == null || freshNeuron == null) return;

            for (int i = 0; i < items.size(); i++) {
                Map<String, Object> qa = items.get(i);
                ReviewQuestion question = new ReviewQuestion();
                question.setSrItem(freshItem);
                question.setNeuron(freshNeuron);
                question.setQuestionText((String) qa.get("question"));
                question.setAnswerText((String) qa.get("answer"));
                question.setQuestionOrder(i);
                question.setContentHash(ctx.contentHash());
                question.setStatus(ReviewQuestionStatus.READY);
                reviewQuestionRepository.save(question);
            }
        });

        log.info("Generated {} review questions for neuron {} (SR item {})",
                items.size(), ctx.neuronId(), ctx.srItemId());
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

    private ReviewQuestionResponse toResponse(ReviewQuestion q) {
        return new ReviewQuestionResponse(q.getId(), q.getQuestionText(), q.getAnswerText(), q.getQuestionOrder());
    }
}
