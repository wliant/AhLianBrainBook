package com.wliant.brainbook.repository;

import com.wliant.brainbook.model.TodoMetadata;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface TodoMetadataRepository extends JpaRepository<TodoMetadata, UUID> {

    Optional<TodoMetadata> findByNeuronId(UUID neuronId);

    List<TodoMetadata> findByNeuronIdIn(List<UUID> neuronIds);

    void deleteByNeuronId(UUID neuronId);
}
