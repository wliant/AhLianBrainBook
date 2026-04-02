package com.wliant.brainbook.repository;

import com.wliant.brainbook.model.ReviewQuestion;
import com.wliant.brainbook.model.ReviewQuestionStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface ReviewQuestionRepository extends JpaRepository<ReviewQuestion, UUID> {

    List<ReviewQuestion> findBySrItemIdAndStatusOrderByQuestionOrder(UUID srItemId, ReviewQuestionStatus status);

    boolean existsBySrItemIdAndStatus(UUID srItemId, ReviewQuestionStatus status);

    void deleteBySrItemId(UUID srItemId);

    @Modifying
    @Query("UPDATE ReviewQuestion q SET q.status = com.wliant.brainbook.model.ReviewQuestionStatus.STALE, "
            + "q.updatedAt = CURRENT_TIMESTAMP "
            + "WHERE q.neuronId = :neuronId AND (q.contentHash IS NULL OR q.contentHash <> :currentHash)")
    int markStaleByNeuronId(@Param("neuronId") UUID neuronId, @Param("currentHash") String currentHash);
}
