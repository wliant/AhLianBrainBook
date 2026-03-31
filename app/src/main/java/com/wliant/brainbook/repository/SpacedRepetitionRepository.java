package com.wliant.brainbook.repository;

import com.wliant.brainbook.model.SpacedRepetitionItem;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface SpacedRepetitionRepository extends JpaRepository<SpacedRepetitionItem, UUID> {

    Optional<SpacedRepetitionItem> findByNeuronId(UUID neuronId);

    List<SpacedRepetitionItem> findByNextReviewAtLessThanEqualOrderByNextReviewAtAsc(LocalDateTime now);

    void deleteByNeuronId(UUID neuronId);
}
