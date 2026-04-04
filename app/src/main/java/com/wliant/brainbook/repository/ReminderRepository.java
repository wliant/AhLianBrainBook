package com.wliant.brainbook.repository;

import com.wliant.brainbook.model.Reminder;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Repository
public interface ReminderRepository extends JpaRepository<Reminder, UUID> {

    List<Reminder> findByNeuronIdOrderByCreatedAtDesc(UUID neuronId);

    long countByNeuronId(UUID neuronId);

    List<Reminder> findByIsActiveTrueAndTriggerAtLessThanEqual(LocalDateTime now);

    @Query("SELECT r FROM Reminder r JOIN FETCH r.neuron WHERE r.isActive = true ORDER BY r.triggerAt ASC")
    List<Reminder> findAllActiveWithNeuronOrderByTriggerAtAsc();
}
