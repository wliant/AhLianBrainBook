package com.wliant.brainbook.repository;

import com.wliant.brainbook.model.Tag;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

@Repository
public interface TagRepository extends JpaRepository<Tag, UUID> {

    List<Tag> findByNameContainingIgnoreCase(String query);

    List<Tag> findByIdIn(Collection<UUID> ids);

    @Query(value = "SELECT nt.neuron_id, t.id, t.name, t.color, t.created_at, t.updated_at " +
            "FROM neuron_tags nt JOIN tags t ON nt.tag_id = t.id " +
            "WHERE nt.neuron_id IN :neuronIds", nativeQuery = true)
    List<Object[]> findTagsWithNeuronIds(@Param("neuronIds") Collection<UUID> neuronIds);

    @Query(value = "SELECT bt.brain_id, t.id, t.name, t.color, t.created_at, t.updated_at " +
            "FROM brain_tags bt JOIN tags t ON bt.tag_id = t.id " +
            "WHERE bt.brain_id IN :brainIds", nativeQuery = true)
    List<Object[]> findTagsWithBrainIds(@Param("brainIds") Collection<UUID> brainIds);
}
