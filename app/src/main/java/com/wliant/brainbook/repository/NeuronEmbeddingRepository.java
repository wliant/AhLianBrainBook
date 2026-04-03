package com.wliant.brainbook.repository;

import com.wliant.brainbook.model.NeuronEmbedding;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface NeuronEmbeddingRepository extends JpaRepository<NeuronEmbedding, UUID> {

    @Query(value = """
            SELECT ne.neuron_id,
                   1 - (ne.embedding <=> CAST(:embedding AS vector)) AS similarity
            FROM neuron_embeddings ne
            JOIN neurons n ON n.id = ne.neuron_id
            WHERE ne.neuron_id != :neuronId
            AND n.brain_id = :brainId
            AND n.is_deleted = false
            AND n.is_archived = false
            ORDER BY ne.embedding <=> CAST(:embedding AS vector)
            LIMIT :lim
            """, nativeQuery = true)
    List<Object[]> findMostSimilar(@Param("neuronId") UUID neuronId,
                                    @Param("embedding") String embedding,
                                    @Param("brainId") UUID brainId,
                                    @Param("lim") int limit);

    @Modifying
    @Query(value = """
            INSERT INTO neuron_embeddings (neuron_id, embedding, model_name, updated_at)
            VALUES (:neuronId, CAST(:embedding AS vector), :modelName, NOW())
            ON CONFLICT (neuron_id) DO UPDATE
            SET embedding = CAST(:embedding AS vector),
                model_name = :modelName,
                updated_at = NOW()
            """, nativeQuery = true)
    void upsertEmbedding(@Param("neuronId") UUID neuronId,
                          @Param("embedding") String embedding,
                          @Param("modelName") String modelName);
}
