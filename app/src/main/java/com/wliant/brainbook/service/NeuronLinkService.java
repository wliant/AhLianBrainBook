package com.wliant.brainbook.service;

import com.wliant.brainbook.dto.NeuronLinkRequest;
import com.wliant.brainbook.dto.NeuronLinkResponse;
import com.wliant.brainbook.exception.ConflictException;
import com.wliant.brainbook.exception.ResourceNotFoundException;
import com.wliant.brainbook.model.Neuron;
import com.wliant.brainbook.model.NeuronLink;
import com.wliant.brainbook.repository.NeuronLinkRepository;
import com.wliant.brainbook.repository.NeuronRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@Transactional
public class NeuronLinkService {

    private final NeuronLinkRepository neuronLinkRepository;
    private final NeuronRepository neuronRepository;

    public NeuronLinkService(NeuronLinkRepository neuronLinkRepository,
                             NeuronRepository neuronRepository) {
        this.neuronLinkRepository = neuronLinkRepository;
        this.neuronRepository = neuronRepository;
    }

    public List<NeuronLinkResponse> getLinksForNeuron(UUID neuronId) {
        neuronRepository.findById(neuronId)
                .orElseThrow(() -> new ResourceNotFoundException("Neuron not found: " + neuronId));
        return neuronLinkRepository.findAllByNeuronId(neuronId)
                .stream().map(this::toResponse).collect(Collectors.toList());
    }

    public List<NeuronLinkResponse> getLinksForBrain(UUID brainId) {
        return neuronLinkRepository.findAllByBrainId(brainId)
                .stream().map(this::toResponse).collect(Collectors.toList());
    }

    public NeuronLinkResponse create(NeuronLinkRequest req) {
        Neuron source = neuronRepository.findById(req.sourceNeuronId())
                .orElseThrow(() -> new ResourceNotFoundException("Source neuron not found: " + req.sourceNeuronId()));
        Neuron target = neuronRepository.findById(req.targetNeuronId())
                .orElseThrow(() -> new ResourceNotFoundException("Target neuron not found: " + req.targetNeuronId()));

        if (req.sourceNeuronId().equals(req.targetNeuronId())) {
            throw new ConflictException("Cannot link a neuron to itself");
        }

        neuronLinkRepository.findBySourceNeuronIdAndTargetNeuronId(req.sourceNeuronId(), req.targetNeuronId())
                .ifPresent(existing -> {
                    throw new ConflictException("Link already exists between these neurons");
                });

        NeuronLink link = new NeuronLink();
        link.setSourceNeuron(source);
        link.setTargetNeuron(target);
        link.setLabel(req.label());
        link.setLinkType(req.linkType());
        link.setWeight(req.weight() != null ? req.weight() : 1.0);

        NeuronLink saved = neuronLinkRepository.save(link);
        return toResponse(saved);
    }

    public void delete(UUID id) {
        NeuronLink link = neuronLinkRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Neuron link not found: " + id));
        neuronLinkRepository.delete(link);
    }

    private NeuronLinkResponse toResponse(NeuronLink link) {
        UUID sourceId = link.getSourceNeuron() != null ? link.getSourceNeuron().getId() : link.getSourceNeuronId();
        UUID targetId = link.getTargetNeuron() != null ? link.getTargetNeuron().getId() : link.getTargetNeuronId();
        return new NeuronLinkResponse(
                link.getId(),
                sourceId,
                link.getSourceNeuron() != null ? link.getSourceNeuron().getTitle() : null,
                link.getSourceNeuron() != null ? link.getSourceNeuron().getClusterId() : null,
                targetId,
                link.getTargetNeuron() != null ? link.getTargetNeuron().getTitle() : null,
                link.getTargetNeuron() != null ? link.getTargetNeuron().getClusterId() : null,
                link.getLabel(),
                link.getLinkType(),
                link.getWeight(),
                link.getCreatedAt()
        );
    }
}
