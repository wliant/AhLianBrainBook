package com.wliant.brainbook.repository;

import com.wliant.brainbook.model.ReviewQuestion;
import com.wliant.brainbook.model.SpacedRepetitionItem;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface SpacedRepetitionRepository extends JpaRepository<SpacedRepetitionItem, UUID> {

    Optional<SpacedRepetitionItem> findByNeuronId(UUID neuronId);

    void deleteByNeuronId(UUID neuronId);

    @Query("SELECT i FROM SpacedRepetitionItem i JOIN FETCH i.neuron WHERE i.nextReviewAt <= :now ORDER BY i.nextReviewAt ASC")
    List<SpacedRepetitionItem> findDueForReviewWithNeuron(@Param("now") LocalDateTime now);

    @Query("SELECT i FROM SpacedRepetitionItem i JOIN FETCH i.neuron")
    List<SpacedRepetitionItem> findAllWithNeuron();

    @Query("SELECT i FROM SpacedRepetitionItem i JOIN FETCH i.neuron "
            + "WHERE i.nextReviewAt <= :horizon "
            + "AND NOT EXISTS (SELECT 1 FROM ReviewQuestion q WHERE q.srItemId = i.id "
            + "AND q.status = com.wliant.brainbook.model.ReviewQuestionStatus.READY)")
    List<SpacedRepetitionItem> findDueWithoutReadyQuestions(@Param("horizon") LocalDateTime horizon);
}
