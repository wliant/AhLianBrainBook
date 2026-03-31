package com.wliant.brainbook.service;

import com.wliant.brainbook.dto.BrainStatsResponse;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.sql.Timestamp;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Service
@Transactional(readOnly = true)
public class BrainStatsService {

    @PersistenceContext
    private EntityManager entityManager;

    @Cacheable(value = "brainStats", key = "#brainId")
    @SuppressWarnings("unchecked")
    public BrainStatsResponse getStats(UUID brainId) {
        // Cluster count
        int clusterCount = ((Number) entityManager.createNativeQuery(
                "SELECT COUNT(*) FROM clusters WHERE brain_id = :brainId AND is_archived = false")
                .setParameter("brainId", brainId)
                .getSingleResult()).intValue();

        // Neuron count
        int neuronCount = ((Number) entityManager.createNativeQuery(
                "SELECT COUNT(*) FROM neurons WHERE brain_id = :brainId AND is_deleted = false AND is_archived = false")
                .setParameter("brainId", brainId)
                .getSingleResult()).intValue();

        // Tag count
        int tagCount = ((Number) entityManager.createNativeQuery(
                "SELECT COUNT(DISTINCT t.tag_id) FROM neuron_tags t " +
                "JOIN neurons n ON t.neuron_id = n.id WHERE n.brain_id = :brainId AND n.is_deleted = false")
                .setParameter("brainId", brainId)
                .getSingleResult()).intValue();

        // Link count
        int linkCount = ((Number) entityManager.createNativeQuery(
                "SELECT COUNT(*) FROM neuron_links nl " +
                "JOIN neurons n ON nl.source_neuron_id = n.id WHERE n.brain_id = :brainId")
                .setParameter("brainId", brainId)
                .getSingleResult()).intValue();

        // Complexity counts via GROUP BY
        int simpleCount = 0, moderateCount = 0, complexCount = 0;
        List<Object[]> complexityRows = entityManager.createNativeQuery(
                "SELECT complexity, COUNT(*) FROM neurons " +
                "WHERE brain_id = :brainId AND is_deleted = false AND is_archived = false " +
                "AND complexity IS NOT NULL GROUP BY complexity")
                .setParameter("brainId", brainId)
                .getResultList();
        for (Object[] row : complexityRows) {
            String complexity = (String) row[0];
            int count = ((Number) row[1]).intValue();
            switch (complexity) {
                case "simple" -> simpleCount = count;
                case "moderate" -> moderateCount = count;
                case "complex" -> complexCount = count;
            }
        }

        // Most connected neurons (top 5) — count links where neuron is source or target
        List<Object[]> connectedRows = entityManager.createNativeQuery(
                "SELECT n.id, n.title, n.cluster_id, cnt FROM (" +
                "  SELECT neuron_id, COUNT(*) AS cnt FROM (" +
                "    SELECT source_neuron_id AS neuron_id FROM neuron_links nl " +
                "      JOIN neurons n ON nl.source_neuron_id = n.id WHERE n.brain_id = :brainId " +
                "    UNION ALL " +
                "    SELECT target_neuron_id AS neuron_id FROM neuron_links nl " +
                "      JOIN neurons n ON nl.target_neuron_id = n.id WHERE n.brain_id = :brainId" +
                "  ) sub GROUP BY neuron_id ORDER BY cnt DESC LIMIT 5" +
                ") ranked JOIN neurons n ON ranked.neuron_id = n.id ORDER BY cnt DESC")
                .setParameter("brainId", brainId)
                .getResultList();

        List<BrainStatsResponse.TopNeuron> mostConnected = new ArrayList<>();
        for (Object[] row : connectedRows) {
            mostConnected.add(new BrainStatsResponse.TopNeuron(
                    (UUID) row[0], (String) row[1], (UUID) row[2], ((Number) row[3]).intValue()));
        }

        // Recently edited (top 5)
        List<Object[]> recentRows = entityManager.createNativeQuery(
                "SELECT id, title, cluster_id, last_edited_at FROM neurons " +
                "WHERE brain_id = :brainId AND is_deleted = false AND is_archived = false " +
                "ORDER BY last_edited_at DESC NULLS LAST LIMIT 5")
                .setParameter("brainId", brainId)
                .getResultList();

        List<BrainStatsResponse.RecentNeuron> recentlyEdited = new ArrayList<>();
        for (Object[] row : recentRows) {
            recentlyEdited.add(new BrainStatsResponse.RecentNeuron(
                    (UUID) row[0], (String) row[1], (UUID) row[2],
                    row[3] != null ? ((Timestamp) row[3]).toLocalDateTime() : null));
        }

        return new BrainStatsResponse(
                clusterCount, neuronCount, tagCount, linkCount,
                simpleCount, moderateCount, complexCount,
                mostConnected, recentlyEdited);
    }
}
