package com.wliant.brainbook.repository;

import com.wliant.brainbook.model.Thought;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface ThoughtRepository extends JpaRepository<Thought, UUID> {

    List<Thought> findAllByOrderBySortOrderAsc();
}
