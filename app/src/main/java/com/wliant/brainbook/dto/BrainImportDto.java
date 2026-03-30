package com.wliant.brainbook.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.util.List;

public record BrainImportDto(
    @NotBlank(message = "Brain name is required")
    @Size(max = 255)
    String name,

    String description,

    List<ImportCluster> clusters,
    List<ImportTag> tags,
    List<ImportLink> links
) {
    public record ImportCluster(
        String tempId,
        String name,
        String parentTempId,
        int sortOrder,
        List<ImportNeuron> neurons
    ) { }

    public record ImportNeuron(
        String tempId,
        String title,
        String contentJson,
        String contentText,
        int sortOrder,
        List<String> tagNames
    ) { }

    public record ImportTag(
        String name,
        String color
    ) { }

    public record ImportLink(
        String sourceTempId,
        String targetTempId,
        String label,
        String linkType,
        Double weight
    ) { }
}
