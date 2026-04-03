package com.wliant.brainbook.repository;

import com.wliant.brainbook.model.LinkSuggestion;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface LinkSuggestionRepository extends JpaRepository<LinkSuggestion, UUID> {

    @Query(value = """
            SELECT ls.id, ls.source_neuron_id, ls.target_neuron_id,
                   ls.suggestion_type, ls.score, ls.created_at,
                   'references' AS display_type,
                   sn.title AS source_title, sn.cluster_id AS source_cluster_id,
                   tn.title AS target_title, tn.cluster_id AS target_cluster_id
            FROM link_suggestions ls
            JOIN neurons sn ON sn.id = ls.source_neuron_id
            JOIN neurons tn ON tn.id = ls.target_neuron_id
            WHERE ls.source_neuron_id = :neuronId AND ls.suggestion_type = 'references'
            AND NOT EXISTS (
                SELECT 1 FROM neuron_links nl
                WHERE nl.source_neuron_id = ls.source_neuron_id
                AND nl.target_neuron_id = ls.target_neuron_id
            )
            UNION ALL
            SELECT ls.id, ls.source_neuron_id, ls.target_neuron_id,
                   ls.suggestion_type, ls.score, ls.created_at,
                   'referenced_by' AS display_type,
                   sn.title AS source_title, sn.cluster_id AS source_cluster_id,
                   tn.title AS target_title, tn.cluster_id AS target_cluster_id
            FROM link_suggestions ls
            JOIN neurons sn ON sn.id = ls.source_neuron_id
            JOIN neurons tn ON tn.id = ls.target_neuron_id
            WHERE ls.target_neuron_id = :neuronId AND ls.suggestion_type = 'references'
            AND NOT EXISTS (
                SELECT 1 FROM neuron_links nl
                WHERE nl.source_neuron_id = ls.source_neuron_id
                AND nl.target_neuron_id = ls.target_neuron_id
            )
            UNION ALL
            SELECT ls.id, ls.source_neuron_id, ls.target_neuron_id,
                   ls.suggestion_type, ls.score, ls.created_at,
                   'related' AS display_type,
                   sn.title AS source_title, sn.cluster_id AS source_cluster_id,
                   tn.title AS target_title, tn.cluster_id AS target_cluster_id
            FROM link_suggestions ls
            JOIN neurons sn ON sn.id = ls.source_neuron_id
            JOIN neurons tn ON tn.id = ls.target_neuron_id
            WHERE ls.source_neuron_id = :neuronId AND ls.suggestion_type = 'related'
            AND NOT EXISTS (
                SELECT 1 FROM neuron_links nl
                WHERE (nl.source_neuron_id = ls.source_neuron_id AND nl.target_neuron_id = ls.target_neuron_id)
                OR (nl.source_neuron_id = ls.target_neuron_id AND nl.target_neuron_id = ls.source_neuron_id)
            )
            ORDER BY display_type, score DESC
            """, nativeQuery = true)
    List<Object[]> findSuggestionsForNeuron(@Param("neuronId") UUID neuronId);

    @Modifying
    @Query("DELETE FROM LinkSuggestion ls WHERE ls.sourceNeuronId = :neuronId AND ls.suggestionType = :type")
    void deleteBySourceNeuronIdAndSuggestionType(@Param("neuronId") UUID neuronId, @Param("type") String type);

    List<LinkSuggestion> findBySourceNeuronIdAndSuggestionType(UUID sourceNeuronId, String suggestionType);
}
