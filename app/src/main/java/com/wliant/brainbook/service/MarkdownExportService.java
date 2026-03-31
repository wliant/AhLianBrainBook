package com.wliant.brainbook.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.wliant.brainbook.exception.ResourceNotFoundException;
import com.wliant.brainbook.model.Cluster;
import com.wliant.brainbook.model.Neuron;
import com.wliant.brainbook.repository.BrainRepository;
import com.wliant.brainbook.repository.ClusterRepository;
import com.wliant.brainbook.repository.NeuronRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

@Service
@Transactional(readOnly = true)
public class MarkdownExportService {

    private static final Logger logger = LoggerFactory.getLogger(MarkdownExportService.class);

    private final NeuronRepository neuronRepository;
    private final BrainRepository brainRepository;
    private final ClusterRepository clusterRepository;
    private final ObjectMapper objectMapper;

    public MarkdownExportService(NeuronRepository neuronRepository,
                                  BrainRepository brainRepository,
                                  ClusterRepository clusterRepository,
                                  ObjectMapper objectMapper) {
        this.neuronRepository = neuronRepository;
        this.brainRepository = brainRepository;
        this.clusterRepository = clusterRepository;
        this.objectMapper = objectMapper;
    }

    public String exportNeuronAsMarkdown(UUID neuronId) {
        Neuron neuron = neuronRepository.findById(neuronId)
                .orElseThrow(() -> new ResourceNotFoundException("Neuron not found: " + neuronId));
        return neuronToMarkdown(neuron);
    }

    public byte[] exportBrainAsMarkdownZip(UUID brainId) {
        brainRepository.findById(brainId)
                .orElseThrow(() -> new ResourceNotFoundException("Brain not found: " + brainId));

        List<Cluster> clusters = clusterRepository.findByBrainIdOrderBySortOrder(brainId);
        Map<UUID, String> clusterNames = clusters.stream()
                .collect(Collectors.toMap(Cluster::getId, Cluster::getName));

        List<Neuron> neurons = neuronRepository
                .findByBrainIdAndIsDeletedFalseAndIsArchivedFalseOrderByLastEditedAtDesc(brainId);

        try (ByteArrayOutputStream baos = new ByteArrayOutputStream();
             ZipOutputStream zos = new ZipOutputStream(baos)) {

            for (Neuron neuron : neurons) {
                String clusterDir = sanitizeFilename(clusterNames.getOrDefault(neuron.getClusterId(), "uncategorized"));
                String filename = sanitizeFilename(neuron.getTitle() != null ? neuron.getTitle() : "untitled") + ".md";
                String path = clusterDir + "/" + filename;

                String markdown = neuronToMarkdown(neuron);
                zos.putNextEntry(new ZipEntry(path));
                zos.write(markdown.getBytes(java.nio.charset.StandardCharsets.UTF_8));
                zos.closeEntry();
            }

            zos.finish();
            return baos.toByteArray();
        } catch (IOException e) {
            throw new RuntimeException("Failed to create markdown zip", e);
        }
    }

    String neuronToMarkdown(Neuron neuron) {
        StringBuilder sb = new StringBuilder();
        sb.append("# ").append(neuron.getTitle() != null ? neuron.getTitle() : "Untitled").append("\n\n");

        String contentJson = neuron.getContentJson();
        if (contentJson != null && !contentJson.isBlank()) {
            try {
                JsonNode root = objectMapper.readTree(contentJson);
                // Handle sections format: {"version":2,"sections":[...]}
                if (root.has("sections") && root.get("sections").isArray()) {
                    for (JsonNode section : root.get("sections")) {
                        convertSectionToMarkdown(section, sb);
                    }
                }
                // Handle TipTap format: {"type":"doc","content":[...]}
                else if (root.has("type") && "doc".equals(root.get("type").asText())) {
                    if (root.has("content") && root.get("content").isArray()) {
                        for (JsonNode node : root.get("content")) {
                            convertTipTapNodeToMarkdown(node, sb, 0);
                        }
                    }
                }
            } catch (Exception e) {
                logger.warn("Failed to parse content JSON for neuron {}, falling back to plain text", neuron.getId());
                if (neuron.getContentText() != null) {
                    sb.append(neuron.getContentText());
                }
            }
        } else if (neuron.getContentText() != null) {
            sb.append(neuron.getContentText());
        }

        return sb.toString();
    }

    private void convertSectionToMarkdown(JsonNode section, StringBuilder sb) {
        String type = section.has("type") ? section.get("type").asText() : "richtext";
        switch (type) {
            case "richtext" -> {
                JsonNode content = section.get("content");
                if (content != null && content.has("type") && content.has("content")) {
                    for (JsonNode node : content.get("content")) {
                        convertTipTapNodeToMarkdown(node, sb, 0);
                    }
                }
            }
            case "code" -> {
                String language = section.has("language") ? section.get("language").asText() : "";
                String code = section.has("code") ? section.get("code").asText() : "";
                sb.append("```").append(language).append("\n");
                sb.append(code).append("\n");
                sb.append("```\n\n");
            }
            case "math" -> {
                String expression = section.has("expression") ? section.get("expression").asText() : "";
                sb.append("$$\n").append(expression).append("\n$$\n\n");
            }
            case "diagram" -> {
                String diagramType = section.has("diagramType") ? section.get("diagramType").asText() : "mermaid";
                String code = section.has("code") ? section.get("code").asText() : "";
                sb.append("```").append(diagramType).append("\n");
                sb.append(code).append("\n");
                sb.append("```\n\n");
            }
            case "callout" -> {
                String calloutType = section.has("calloutType") ? section.get("calloutType").asText() : "info";
                String text = section.has("text") ? section.get("text").asText() : "";
                sb.append("> **").append(calloutType.toUpperCase()).append("**: ").append(text).append("\n\n");
            }
            default -> {
                // For unknown types, try to extract text content
                if (section.has("content") && section.get("content").isTextual()) {
                    sb.append(section.get("content").asText()).append("\n\n");
                }
            }
        }
    }

    private void convertTipTapNodeToMarkdown(JsonNode node, StringBuilder sb, int depth) {
        String type = node.has("type") ? node.get("type").asText() : "";
        switch (type) {
            case "heading" -> {
                int level = node.has("attrs") && node.get("attrs").has("level")
                        ? node.get("attrs").get("level").asInt() : 1;
                sb.append("#".repeat(Math.min(level, 6))).append(" ");
                appendInlineContent(node, sb);
                sb.append("\n\n");
            }
            case "paragraph" -> {
                appendInlineContent(node, sb);
                sb.append("\n\n");
            }
            case "bulletList" -> {
                if (node.has("content")) {
                    for (JsonNode item : node.get("content")) {
                        sb.append("  ".repeat(depth)).append("- ");
                        convertListItemContent(item, sb, depth);
                    }
                }
                if (depth == 0) sb.append("\n");
            }
            case "orderedList" -> {
                if (node.has("content")) {
                    int i = 1;
                    for (JsonNode item : node.get("content")) {
                        sb.append("  ".repeat(depth)).append(i++).append(". ");
                        convertListItemContent(item, sb, depth);
                    }
                }
                if (depth == 0) sb.append("\n");
            }
            case "blockquote" -> {
                if (node.has("content")) {
                    for (JsonNode child : node.get("content")) {
                        sb.append("> ");
                        appendInlineContent(child, sb);
                        sb.append("\n");
                    }
                }
                sb.append("\n");
            }
            case "codeBlock" -> {
                String language = node.has("attrs") && node.get("attrs").has("language")
                        ? node.get("attrs").get("language").asText() : "";
                sb.append("```").append(language).append("\n");
                appendInlineContent(node, sb);
                sb.append("\n```\n\n");
            }
            case "horizontalRule" -> sb.append("---\n\n");
            case "hardBreak" -> sb.append("  \n");
            default -> {
                // For other nodes, recurse into content
                if (node.has("content") && node.get("content").isArray()) {
                    for (JsonNode child : node.get("content")) {
                        convertTipTapNodeToMarkdown(child, sb, depth);
                    }
                }
            }
        }
    }

    private void convertListItemContent(JsonNode item, StringBuilder sb, int depth) {
        if (item.has("content") && item.get("content").isArray()) {
            boolean first = true;
            for (JsonNode child : item.get("content")) {
                String childType = child.has("type") ? child.get("type").asText() : "";
                if ("paragraph".equals(childType)) {
                    if (!first) sb.append("  ".repeat(depth + 1));
                    appendInlineContent(child, sb);
                    sb.append("\n");
                } else if ("bulletList".equals(childType) || "orderedList".equals(childType)) {
                    convertTipTapNodeToMarkdown(child, sb, depth + 1);
                }
                first = false;
            }
        }
    }

    private void appendInlineContent(JsonNode node, StringBuilder sb) {
        if (!node.has("content") || !node.get("content").isArray()) {
            if (node.has("text")) {
                sb.append(node.get("text").asText());
            }
            return;
        }
        for (JsonNode child : node.get("content")) {
            if (child.has("text")) {
                String text = child.get("text").asText();
                // Apply marks
                if (child.has("marks") && child.get("marks").isArray()) {
                    for (JsonNode mark : child.get("marks")) {
                        String markType = mark.has("type") ? mark.get("type").asText() : "";
                        switch (markType) {
                            case "bold" -> text = "**" + text + "**";
                            case "italic" -> text = "_" + text + "_";
                            case "code" -> text = "`" + text + "`";
                            case "strike" -> text = "~~" + text + "~~";
                            case "link" -> {
                                String href = mark.has("attrs") && mark.get("attrs").has("href")
                                        ? mark.get("attrs").get("href").asText() : "";
                                text = "[" + text + "](" + href + ")";
                            }
                        }
                    }
                }
                sb.append(text);
            } else if (child.has("type") && "hardBreak".equals(child.get("type").asText())) {
                sb.append("  \n");
            }
        }
    }

    private String sanitizeFilename(String name) {
        return name.replaceAll("[^a-zA-Z0-9._\\- ]", "").trim().replaceAll("\\s+", "_");
    }
}
