package com.wliant.brainbook.dto;

public record BrainStatsResponse(
    int clusterCount,
    int neuronCount,
    int tagCount,
    int linkCount,
    int simpleCount,
    int moderateCount,
    int complexCount,
    java.util.List<TopNeuron> mostConnected,
    java.util.List<RecentNeuron> recentlyEdited
) {
    public record TopNeuron(java.util.UUID id, String title, java.util.UUID clusterId, int linkCount) { }
    public record RecentNeuron(java.util.UUID id, String title, java.util.UUID clusterId, java.time.LocalDateTime lastEditedAt) { }
}
