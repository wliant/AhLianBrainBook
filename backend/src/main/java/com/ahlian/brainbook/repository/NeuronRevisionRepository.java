package com.ahlian.brainbook.repository;

import com.ahlian.brainbook.model.NeuronRevision;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface NeuronRevisionRepository extends JpaRepository<NeuronRevision, UUID> {

    List<NeuronRevision> findByNeuronIdOrderByRevisionNumberDesc(UUID neuronId);

    Optional<NeuronRevision> findTopByNeuronIdOrderByRevisionNumberDesc(UUID neuronId);
}
