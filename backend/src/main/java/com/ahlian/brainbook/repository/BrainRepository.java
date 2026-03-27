package com.ahlian.brainbook.repository;

import com.ahlian.brainbook.model.Brain;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface BrainRepository extends JpaRepository<Brain, UUID> {

    List<Brain> findByIsArchivedFalseOrderBySortOrder();

    List<Brain> findByIsArchivedTrueOrderByUpdatedAtDesc();
}
