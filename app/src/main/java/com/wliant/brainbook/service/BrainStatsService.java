package com.wliant.brainbook.service;

import com.wliant.brainbook.dto.BrainStatsResponse;
import com.wliant.brainbook.model.Neuron;
import com.wliant.brainbook.model.NeuronLink;
import com.wliant.brainbook.repository.ClusterRepository;
import com.wliant.brainbook.repository.NeuronLinkRepository;
import com.wliant.brainbook.repository.NeuronRepository;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;
import java.util.stream.Collectors;

@Service
@Transactional(readOnly = true)
public class BrainStatsService {

    private final ClusterRepository clusterRepository;
    private final NeuronRepository neuronRepository;
    private final NeuronLinkRepository neuronLinkRepository;

    @PersistenceContext
    private EntityManager entityManager;

    public BrainStatsService(ClusterRepository clusterRepository,
                             NeuronRepository neuronRepository,
                             NeuronLinkRepository neuronLinkRepository) {
        this.clusterRepository = clusterRepository;
        this.neuronRepository = neuronRepository;
        this.neuronLinkRepository = neuronLinkRepository;
    }

    public BrainStatsResponse getStats(UUID brainId) {
        int clusterCount = clusterRepository.findByBrainIdOrderBySortOrder(brainId).size();

        List<Neuron> neurons = neuronRepository
                .findByBrainIdAndIsDeletedFalseAndIsArchivedFalseOrderByLastEditedAtDesc(brainId);
        int neuronCount = neurons.size();

        // Tag count
        Number tagCount = (Number) entityManager.createNativeQuery(
                "SELECT COUNT(DISTINCT t.tag_id) FROM neuron_tags t " +
                "JOIN neurons n ON t.neuron_id = n.id WHERE n.brain_id = :brainId AND n.is_deleted = false")
                .setParameter("brainId", brainId)
                .getSingleResult();

        List<NeuronLink> links = neuronLinkRepository.findAllByBrainId(brainId);
        int linkCount = links.size();

        // Complexity counts
        int simpleCount = 0, moderateCount = 0, complexCount = 0;
        for (Neuron n : neurons) {
            if ("simple".equals(n.getComplexity())) simpleCount++;
            else if ("moderate".equals(n.getComplexity())) moderateCount++;
            else if ("complex".equals(n.getComplexity())) complexCount++;
        }

        // Most connected neurons (top 5)
        Map<UUID, Integer> connectionCounts = new HashMap<>();
        for (NeuronLink link : links) {
            UUID src = link.getSourceNeuron() != null ? link.getSourceNeuron().getId() : null;
            UUID tgt = link.getTargetNeuron() != null ? link.getTargetNeuron().getId() : null;
            if (src != null) connectionCounts.merge(src, 1, Integer::sum);
            if (tgt != null) connectionCounts.merge(tgt, 1, Integer::sum);
        }

        Map<UUID, Neuron> neuronMap = neurons.stream().collect(Collectors.toMap(Neuron::getId, n -> n));

        List<BrainStatsResponse.TopNeuron> mostConnected = connectionCounts.entrySet().stream()
                .sorted(Map.Entry.<UUID, Integer>comparingByValue().reversed())
                .limit(5)
                .map(e -> {
                    Neuron n = neuronMap.get(e.getKey());
                    return new BrainStatsResponse.TopNeuron(
                            e.getKey(),
                            n != null ? n.getTitle() : "Unknown",
                            n != null ? n.getClusterId() : null,
                            e.getValue());
                })
                .collect(Collectors.toList());

        // Recently edited (top 5)
        List<BrainStatsResponse.RecentNeuron> recentlyEdited = neurons.stream()
                .limit(5)
                .map(n -> new BrainStatsResponse.RecentNeuron(
                        n.getId(), n.getTitle(), n.getClusterId(), n.getLastEditedAt()))
                .collect(Collectors.toList());

        return new BrainStatsResponse(
                clusterCount, neuronCount, tagCount.intValue(), linkCount,
                simpleCount, moderateCount, complexCount,
                mostConnected, recentlyEdited);
    }
}
