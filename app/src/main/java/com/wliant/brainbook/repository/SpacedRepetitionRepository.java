package com.wliant.brainbook.repository;

import com.wliant.brainbook.model.ReviewQuestion;
import com.wliant.brainbook.model.ReviewQuestionMode;
import com.wliant.brainbook.model.SpacedRepetitionItem;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
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
            + "AND i.quizEnabled = true "
            + "AND NOT EXISTS (SELECT 1 FROM ReviewQuestion q WHERE q.srItemId = i.id "
            + "AND q.status = com.wliant.brainbook.model.ReviewQuestionStatus.READY)")
    List<SpacedRepetitionItem> findDueWithoutReadyQuestions(@Param("horizon") LocalDateTime horizon);

    // The quiz settings below are written one column at a time rather than by saving the
    // whole entity. The UI can fire two of these at once — change the format, then the
    // count — and a read-modify-write of the full row makes the second request write back
    // the first's pre-change value, silently losing it.

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("UPDATE SpacedRepetitionItem i SET i.questionMode = :mode, i.updatedAt = :now WHERE i.id = :id")
    int updateQuestionMode(@Param("id") UUID id,
                           @Param("mode") ReviewQuestionMode mode,
                           @Param("now") LocalDateTime now);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("UPDATE SpacedRepetitionItem i SET i.questionCount = :count, i.updatedAt = :now WHERE i.id = :id")
    int updateQuestionCount(@Param("id") UUID id,
                            @Param("count") int count,
                            @Param("now") LocalDateTime now);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("UPDATE SpacedRepetitionItem i SET i.quizEnabled = :enabled, i.updatedAt = :now WHERE i.id = :id")
    int updateQuizEnabled(@Param("id") UUID id,
                          @Param("enabled") boolean enabled,
                          @Param("now") LocalDateTime now);
}
