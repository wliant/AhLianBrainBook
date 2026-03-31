package com.wliant.brainbook.repository;

import com.wliant.brainbook.model.NeuronShare;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface NeuronShareRepository extends JpaRepository<NeuronShare, UUID> {

    Optional<NeuronShare> findByToken(String token);

    List<NeuronShare> findByNeuronIdOrderByCreatedAtDesc(UUID neuronId);

    void deleteByNeuronId(UUID neuronId);
}
