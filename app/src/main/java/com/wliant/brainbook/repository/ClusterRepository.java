package com.wliant.brainbook.repository;

import com.wliant.brainbook.model.Cluster;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface ClusterRepository extends JpaRepository<Cluster, UUID> {

    List<Cluster> findByBrainIdAndIsArchivedFalseOrderBySortOrder(UUID brainId);

    List<Cluster> findByBrainIdOrderBySortOrder(UUID brainId);
}
