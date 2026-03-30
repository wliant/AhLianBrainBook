package com.wliant.brainbook.dto;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

public record BrainExportDto(
    String version,
    BrainData brain,
    List<ClusterData> clusters,
    List<NeuronData> neurons,
    List<TagData> tags,
    List<LinkData> links
) {
    public record BrainData(
        UUID id,
        String name,
        String icon,
        String color,
        String description,
        LocalDateTime createdAt
    ) { }

    public record ClusterData(
        UUID id,
        String name,
        UUID parentClusterId,
        int sortOrder,
        List<String> tagNames
    ) { }

    public record NeuronData(
        UUID id,
        UUID clusterId,
        String title,
        String contentJson,
        String contentText,
        int sortOrder,
        boolean isFavorite,
        boolean isPinned,
        List<String> tagNames,
        LocalDateTime createdAt
    ) { }

    public record TagData(
        String name,
        String color
    ) { }

    public record LinkData(
        UUID sourceNeuronId,
        UUID targetNeuronId,
        String label,
        String linkType,
        Double weight
    ) { }
}
