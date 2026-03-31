package com.wliant.brainbook.service;

import com.wliant.brainbook.dto.NeuronResponse;
import com.wliant.brainbook.dto.RevisionResponse;
import com.wliant.brainbook.dto.TagResponse;
import com.wliant.brainbook.exception.ResourceNotFoundException;
import com.wliant.brainbook.model.Neuron;
import com.wliant.brainbook.model.NeuronRevision;
import com.wliant.brainbook.repository.NeuronRepository;
import com.wliant.brainbook.repository.NeuronRevisionRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
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

    private static final Logger log = LoggerFactory.getLogger(RevisionService.class);
    private static final int MAX_REVISIONS_PER_NEURON = 10;

    private final NeuronRevisionRepository revisionRepository;
    private final NeuronRepository neuronRepository;
    private final TagService tagService;

    public RevisionService(NeuronRevisionRepository revisionRepository,
                           NeuronRepository neuronRepository,
                           TagService tagService) {
        this.revisionRepository = revisionRepository;
        this.neuronRepository = neuronRepository;
        this.tagService = tagService;
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

    public RevisionResponse createRevision(UUID neuronId) {
        Neuron neuron = neuronRepository.findById(neuronId)
                .orElseThrow(() -> new ResourceNotFoundException("Neuron not found: " + neuronId));

        // Enforce max limit: delete oldest if at capacity
        long count = revisionRepository.countByNeuronId(neuronId);
        if (count >= MAX_REVISIONS_PER_NEURON) {
            revisionRepository.findTopByNeuronIdOrderByRevisionNumberAsc(neuronId)
                    .ifPresent(oldest -> {
                        log.info("Max revision limit ({}) reached for neuron {}, deleting oldest revision {}",
                                MAX_REVISIONS_PER_NEURON, neuronId, oldest.getId());
                        revisionRepository.delete(oldest);
                    });
        }

        int nextRevisionNumber = revisionRepository.findTopByNeuronIdOrderByRevisionNumberDesc(neuronId)
                .map(r -> r.getRevisionNumber() + 1)
                .orElse(1);

        NeuronRevision revision = new NeuronRevision();
        revision.setNeuron(neuron);
        revision.setRevisionNumber(nextRevisionNumber);
        revision.setTitle(neuron.getTitle());
        revision.setContentJson(neuron.getContentJson());
        revision.setContentText(neuron.getContentText());

        NeuronRevision saved = revisionRepository.save(revision);
        log.info("Created revision #{} (id={}) for neuron {}", nextRevisionNumber, saved.getId(), neuronId);
        return toResponse(saved);
    }

    public void deleteRevision(UUID revisionId) {
        NeuronRevision revision = revisionRepository.findById(revisionId)
                .orElseThrow(() -> new ResourceNotFoundException("Revision not found: " + revisionId));
        revisionRepository.delete(revision);
        log.info("Deleted revision {} (#{}) for neuron {}",
                revisionId, revision.getRevisionNumber(), revision.getNeuronId());
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

        log.info("Restored neuron {} to revision #{} (id={})",
                neuron.getId(), revision.getRevisionNumber(), revisionId);
        return toNeuronResponse(saved);
    }

    private NeuronResponse toNeuronResponse(Neuron neuron) {
        List<TagResponse> tags;
        try {
            tags = tagService.getTagsForNeuron(neuron.getId());
        } catch (Exception e) {
            tags = Collections.emptyList();
        }

        return new NeuronResponse(
                neuron.getId(),
                neuron.getBrain() != null ? neuron.getBrain().getId() : neuron.getBrainId(),
                neuron.getCluster() != null ? neuron.getCluster().getId() : neuron.getClusterId(),
                neuron.getTitle(),
                neuron.getContentJson(),
                neuron.getContentText(),
                neuron.getTemplateId(),
                neuron.getSortOrder(),
                neuron.isFavorite(),
                neuron.isPinned(),
                neuron.isArchived(),
                neuron.isDeleted(),
                neuron.getVersion(),
                neuron.getComplexity(),
                neuron.getLastEditedAt(),
                neuron.getCreatedAt(),
                neuron.getUpdatedAt(),
                tags
        );
    }

    private RevisionResponse toResponse(NeuronRevision revision) {
        return new RevisionResponse(
                revision.getId(),
                revision.getNeuron() != null ? revision.getNeuron().getId() : revision.getNeuronId(),
                revision.getRevisionNumber(),
                revision.getTitle(),
                revision.getContentJson(),
                revision.getContentText(),
                revision.getCreatedAt()
        );
    }
}
