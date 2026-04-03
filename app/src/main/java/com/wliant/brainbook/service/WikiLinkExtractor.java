package com.wliant.brainbook.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.HashSet;
import java.util.Set;
import java.util.UUID;

public final class WikiLinkExtractor {

    private static final Logger logger = LoggerFactory.getLogger(WikiLinkExtractor.class);
    private static final ObjectMapper objectMapper = new ObjectMapper();

    private WikiLinkExtractor() {}

    public static Set<UUID> extractWikiLinkIds(String contentJson) {
        Set<UUID> ids = new HashSet<>();
        try {
            JsonNode root = objectMapper.readTree(contentJson);
            extractRecursive(root, ids);
        } catch (JsonProcessingException e) {
            logger.error("Failed to parse content JSON for wiki link extraction: {}",
                    contentJson.substring(0, Math.min(100, contentJson.length())), e);
        }
        return ids;
    }

    private static void extractRecursive(JsonNode node, Set<UUID> ids) {
        if (node == null) return;

        if (node.has("type") && "wikiLink".equals(node.get("type").asText())) {
            JsonNode attrs = node.get("attrs");
            if (attrs != null && attrs.has("neuronId")) {
                String neuronIdStr = attrs.get("neuronId").asText();
                try {
                    ids.add(UUID.fromString(neuronIdStr));
                } catch (IllegalArgumentException e) {
                    logger.warn("Invalid UUID in wiki link: {}", neuronIdStr);
                }
            }
        }

        if (node.has("content") && node.get("content").isArray()) {
            for (JsonNode child : node.get("content")) {
                extractRecursive(child, ids);
            }
        }
        if (node.has("sections") && node.get("sections").isArray()) {
            for (JsonNode section : node.get("sections")) {
                if (section.has("content")) {
                    extractRecursive(section.get("content"), ids);
                }
            }
        }
    }
}
