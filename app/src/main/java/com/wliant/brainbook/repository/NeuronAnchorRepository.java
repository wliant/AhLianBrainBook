package com.wliant.brainbook.repository;

import com.wliant.brainbook.model.NeuronAnchor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface NeuronAnchorRepository extends JpaRepository<NeuronAnchor, UUID> {

    Page<NeuronAnchor> findByClusterId(UUID clusterId, Pageable pageable);

    Page<NeuronAnchor> findByClusterIdAndFilePath(UUID clusterId, String filePath, Pageable pageable);

    List<NeuronAnchor> findByClusterIdAndFilePathIn(UUID clusterId, List<String> filePaths);

    Optional<NeuronAnchor> findByNeuronId(UUID neuronId);

    List<NeuronAnchor> findByNeuronIdIn(List<UUID> neuronIds);
}
