package com.wliant.brainbook.service;

import com.wliant.brainbook.dto.*;
import com.wliant.brainbook.exception.ResourceNotFoundException;
import com.wliant.brainbook.model.Brain;
import com.wliant.brainbook.model.Neuron;
import com.wliant.brainbook.model.NeuronShare;
import com.wliant.brainbook.repository.BrainRepository;
import com.wliant.brainbook.repository.NeuronRepository;
import com.wliant.brainbook.repository.NeuronShareRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.util.HexFormat;
import java.util.List;
import java.util.UUID;

@Service
@Transactional
public class ShareService {

    private static final SecureRandom SECURE_RANDOM = new SecureRandom();

    private final NeuronShareRepository shareRepository;
    private final NeuronRepository neuronRepository;
    private final BrainRepository brainRepository;
    private final TagService tagService;

    public ShareService(NeuronShareRepository shareRepository, NeuronRepository neuronRepository,
                        BrainRepository brainRepository, TagService tagService) {
        this.shareRepository = shareRepository;
        this.neuronRepository = neuronRepository;
        this.brainRepository = brainRepository;
        this.tagService = tagService;
    }

    public ShareResponse createShareLink(UUID neuronId, Integer expiresInHours) {
        neuronRepository.findById(neuronId)
                .orElseThrow(() -> new ResourceNotFoundException("Neuron not found: " + neuronId));

        byte[] tokenBytes = new byte[32];
        SECURE_RANDOM.nextBytes(tokenBytes);
        String token = HexFormat.of().formatHex(tokenBytes);

        NeuronShare share = new NeuronShare();
        share.setNeuronId(neuronId);
        share.setToken(token);
        if (expiresInHours != null && expiresInHours > 0) {
            share.setExpiresAt(LocalDateTime.now().plusHours(expiresInHours));
        }

        share = shareRepository.save(share);
        return toResponse(share);
    }

    @Transactional(readOnly = true)
    public SharedNeuronResponse getSharedNeuron(String token) {
        NeuronShare share = shareRepository.findByToken(token)
                .orElseThrow(() -> new ResourceNotFoundException("Share link not found or expired"));

        if (share.getExpiresAt() != null && share.getExpiresAt().isBefore(LocalDateTime.now())) {
            throw new ResourceNotFoundException("Share link has expired");
        }

        Neuron neuron = neuronRepository.findById(share.getNeuronId())
                .orElseThrow(() -> new ResourceNotFoundException("Neuron no longer exists"));

        List<TagResponse> tags = tagService.getTagsForNeuron(neuron.getId());
        String brainName = brainRepository.findById(neuron.getBrainId())
                .map(Brain::getName)
                .orElse(null);

        return new SharedNeuronResponse(
                neuron.getTitle(),
                neuron.getContentJson(),
                tags,
                brainName,
                neuron.getCreatedAt()
        );
    }

    @Transactional(readOnly = true)
    public List<ShareResponse> getSharesForNeuron(UUID neuronId) {
        return shareRepository.findByNeuronIdOrderByCreatedAtDesc(neuronId).stream()
                .map(this::toResponse)
                .toList();
    }

    public void revokeShare(UUID shareId) {
        if (!shareRepository.existsById(shareId)) {
            throw new ResourceNotFoundException("Share not found: " + shareId);
        }
        shareRepository.deleteById(shareId);
    }

    private ShareResponse toResponse(NeuronShare share) {
        return new ShareResponse(
                share.getId(),
                share.getToken(),
                share.getExpiresAt(),
                share.getCreatedAt()
        );
    }
}
