package com.wliant.brainbook.repository;

import com.wliant.brainbook.model.NeuronLink;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface NeuronLinkRepository extends JpaRepository<NeuronLink, UUID> {

    List<NeuronLink> findBySourceNeuronId(UUID sourceNeuronId);

    List<NeuronLink> findByTargetNeuronId(UUID targetNeuronId);

    @Query("SELECT nl FROM NeuronLink nl WHERE nl.sourceNeuronId = :neuronId OR nl.targetNeuronId = :neuronId")
    List<NeuronLink> findAllByNeuronId(@Param("neuronId") UUID neuronId);

    @Query("SELECT nl FROM NeuronLink nl WHERE nl.sourceNeuron.brainId = :brainId")
    List<NeuronLink> findAllByBrainId(@Param("brainId") UUID brainId);

    Optional<NeuronLink> findBySourceNeuronIdAndTargetNeuronId(UUID sourceNeuronId, UUID targetNeuronId);

    List<NeuronLink> findBySourceNeuronIdAndSource(UUID sourceNeuronId, String source);
}
