package com.wliant.brainbook.repository;

import com.wliant.brainbook.model.Neuron;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface NeuronRepository extends JpaRepository<Neuron, UUID> {

    List<Neuron> findByClusterIdAndIsDeletedFalseAndIsArchivedFalseOrderBySortOrderAsc(UUID clusterId);

    List<Neuron> findByBrainIdAndIsDeletedFalseAndIsArchivedFalseOrderByLastEditedAtDesc(UUID brainId);

    Page<Neuron> findByIsDeletedFalseAndIsArchivedFalseOrderByLastEditedAtDesc(Pageable pageable);

    List<Neuron> findByIsFavoriteTrueAndIsDeletedFalseOrderByUpdatedAtDesc();

    List<Neuron> findByIsPinnedTrueAndIsDeletedFalseOrderByUpdatedAtDesc();

    List<Neuron> findByIsDeletedTrueOrderByUpdatedAtDesc();

    List<Neuron> findByIsArchivedTrueAndIsDeletedFalseOrderByUpdatedAtDesc();

    long countByClusterIdAndIsDeletedFalse(UUID clusterId);

    List<Neuron> findByBrainIdAndIsDeletedFalse(UUID brainId);

    List<Neuron> findByTitleContainingIgnoreCaseAndIsDeletedFalse(String title, org.springframework.data.domain.Pageable pageable);

    @Query(value = "SELECT * FROM neurons n " +
            "WHERE n.is_deleted = false " +
            "AND (to_tsvector('english', coalesce(n.content_text, '')) @@ plainto_tsquery('english', :query) " +
            "  OR to_tsvector('english', coalesce(n.title, '')) @@ plainto_tsquery('english', :query))",
            countQuery = "SELECT count(*) FROM neurons n " +
                    "WHERE n.is_deleted = false " +
                    "AND (to_tsvector('english', coalesce(n.content_text, '')) @@ plainto_tsquery('english', :query) " +
                    "  OR to_tsvector('english', coalesce(n.title, '')) @@ plainto_tsquery('english', :query))",
            nativeQuery = true)
    Page<Neuron> search(@Param("query") String query, Pageable pageable);

}
