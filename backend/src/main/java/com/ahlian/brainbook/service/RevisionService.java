package com.ahlian.brainbook.service;

import com.ahlian.brainbook.dto.NeuronResponse;
import com.ahlian.brainbook.dto.RevisionResponse;
import com.ahlian.brainbook.exception.ResourceNotFoundException;
import com.ahlian.brainbook.model.Neuron;
import com.ahlian.brainbook.model.NeuronRevision;
import com.ahlian.brainbook.repository.NeuronRepository;
import com.ahlian.brainbook.repository.NeuronRevisionRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
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

        NeuronResponse resp = new NeuronResponse();
        resp.setId(saved.getId());
        resp.setBrainId(saved.getBrainId());
        resp.setClusterId(saved.getClusterId());
        resp.setTitle(saved.getTitle());
        resp.setContentJson(saved.getContentJson());
        resp.setContentText(saved.getContentText());
        resp.setTemplateId(saved.getTemplateId());
        resp.setArchived(saved.isArchived());
        resp.setDeleted(saved.isDeleted());
        resp.setFavorite(saved.isFavorite());
        resp.setPinned(saved.isPinned());
        resp.setVersion(saved.getVersion());
        resp.setSortOrder(saved.getSortOrder());
        resp.setCreatedAt(saved.getCreatedAt());
        resp.setUpdatedAt(saved.getUpdatedAt());
        resp.setLastEditedAt(saved.getLastEditedAt());
        return resp;
    }

    private RevisionResponse toResponse(NeuronRevision revision) {
        RevisionResponse resp = new RevisionResponse();
        resp.setId(revision.getId());
        resp.setNeuronId(revision.getNeuronId());
        resp.setRevisionNumber(revision.getRevisionNumber());
        resp.setContentJson(revision.getContentJson());
        resp.setContentText(revision.getContentText());
        resp.setCreatedAt(revision.getCreatedAt());
        return resp;
    }
}
