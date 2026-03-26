package com.ahlian.brainbook.repository;

import com.ahlian.brainbook.model.NeuronLink;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface NeuronLinkRepository extends JpaRepository<NeuronLink, UUID> {

    List<NeuronLink> findBySourceNeuronId(UUID sourceNeuronId);

    List<NeuronLink> findByTargetNeuronId(UUID targetNeuronId);
}
