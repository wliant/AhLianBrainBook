package com.wliant.brainbook.service;

import com.wliant.brainbook.dto.NeuronResponse;
import com.wliant.brainbook.dto.RevisionResponse;
import com.wliant.brainbook.exception.ResourceNotFoundException;
import com.wliant.brainbook.model.Neuron;
import com.wliant.brainbook.model.NeuronRevision;
import com.wliant.brainbook.repository.NeuronRepository;
import com.wliant.brainbook.repository.NeuronRevisionRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Collections;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@Transactional
public class RevisionService {

    private final NeuronRevisionRepository revisionRepository;
    private final NeuronRepository neuronRepository;

    public RevisionService(NeuronRevisionRepository revisionRepository,
                           NeuronRepository neuronRepository) {
        this.revisionRepository = revisionRepository;
        this.neuronRepository = neuronRepository;
    }

    public List<RevisionResponse> getRevisions(UUID neuronId) {
        return revisionRepository.findByNeuronIdOrderByRevisionNumberDesc(neuronId).stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    public RevisionResponse getRevision(UUID revisionId) {
        NeuronRevision revision = revisionRepository.findById(revisionId)
                .orElseThrow(() -> new ResourceNotFoundException("Revision not found: " + revisionId));
        return toResponse(revision);
    }

    public RevisionResponse createRevision(UUID neuronId, String reason) {
        Neuron neuron = neuronRepository.findById(neuronId)
                .orElseThrow(() -> new ResourceNotFoundException("Neuron not found: " + neuronId));

        int nextRevisionNumber = revisionRepository.findTopByNeuronIdOrderByRevisionNumberDesc(neuronId)
                .map(r -> r.getRevisionNumber() + 1)
                .orElse(1);

        NeuronRevision revision = new NeuronRevision();
        revision.setNeuron(neuron);
        revision.setRevisionNumber(nextRevisionNumber);
        revision.setContentJson(neuron.getContentJson());
        revision.setContentText(neuron.getContentText());

        NeuronRevision saved = revisionRepository.save(revision);
        return toResponse(saved);
    }

    public NeuronResponse restoreRevision(UUID revisionId) {
        NeuronRevision revision = revisionRepository.findById(revisionId)
                .orElseThrow(() -> new ResourceNotFoundException("Revision not found: " + revisionId));

        Neuron neuron = neuronRepository.findById(revision.getNeuronId())
                .orElseThrow(() -> new ResourceNotFoundException("Neuron not found: " + revision.getNeuronId()));

        neuron.setContentJson(revision.getContentJson());
        neuron.setContentText(revision.getContentText());
        neuron.setVersion(neuron.getVersion() + 1);
        neuron.setLastEditedAt(LocalDateTime.now());
        Neuron saved = neuronRepository.save(neuron);

        return new NeuronResponse(
                saved.getId(),
                saved.getBrain() != null ? saved.getBrain().getId() : saved.getBrainId(),
                saved.getCluster() != null ? saved.getCluster().getId() : saved.getClusterId(),
                saved.getTitle(),
                saved.getContentJson(),
                saved.getContentText(),
                saved.getTemplateId(),
                saved.getSortOrder(),
                saved.isFavorite(),
                saved.isPinned(),
                saved.isArchived(),
                saved.isDeleted(),
                saved.getVersion(),
                saved.getComplexity(),
                saved.getLastEditedAt(),
                saved.getCreatedAt(),
                saved.getUpdatedAt(),
                Collections.emptyList()
        );
    }

    private RevisionResponse toResponse(NeuronRevision revision) {
        return new RevisionResponse(
                revision.getId(),
                revision.getNeuron() != null ? revision.getNeuron().getId() : revision.getNeuronId(),
                revision.getRevisionNumber(),
                revision.getContentJson(),
                revision.getContentText(),
                revision.getCreatedAt()
        );
    }
}
