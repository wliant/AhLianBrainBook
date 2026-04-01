package com.wliant.brainbook.repository;

import com.wliant.brainbook.model.ResearchTopic;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface ResearchTopicRepository extends JpaRepository<ResearchTopic, UUID> {

    List<ResearchTopic> findByClusterIdOrderBySortOrder(UUID clusterId);

    long countByClusterId(UUID clusterId);
}
