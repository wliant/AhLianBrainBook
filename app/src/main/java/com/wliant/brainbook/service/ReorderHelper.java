package com.wliant.brainbook.service;

import com.wliant.brainbook.dto.ReorderRequest;
import com.wliant.brainbook.exception.ResourceNotFoundException;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;
import java.util.function.BiConsumer;

public final class ReorderHelper {

    private ReorderHelper() {}

    public static <T> void reorder(
            ReorderRequest req,
            JpaRepository<T, UUID> repository,
            BiConsumer<T, Integer> setSortOrder,
            String entityName
    ) {
        List<UUID> orderedIds = req.orderedIds();
        for (int i = 0; i < orderedIds.size(); i++) {
            UUID id = orderedIds.get(i);
            T entity = repository.findById(id)
                    .orElseThrow(() -> new ResourceNotFoundException(entityName + " not found: " + id));
            setSortOrder.accept(entity, i);
            repository.save(entity);
        }
    }
}
