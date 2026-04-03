package com.wliant.brainbook.service;

import com.wliant.brainbook.dto.CreateNeuronAnchorRequest;
import com.wliant.brainbook.dto.NeuronAnchorResponse;
import com.wliant.brainbook.dto.UpdateNeuronAnchorRequest;
import com.wliant.brainbook.exception.ConflictException;
import com.wliant.brainbook.exception.ResourceNotFoundException;
import com.wliant.brainbook.model.AnchorStatus;
import com.wliant.brainbook.model.Cluster;
import com.wliant.brainbook.model.Neuron;
import com.wliant.brainbook.model.NeuronAnchor;
import com.wliant.brainbook.repository.ClusterRepository;
import com.wliant.brainbook.repository.NeuronAnchorRepository;
import com.wliant.brainbook.repository.NeuronRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@Transactional
public class AnchorService {

    private final NeuronAnchorRepository neuronAnchorRepository;
    private final NeuronRepository neuronRepository;
    private final ClusterRepository clusterRepository;

    public AnchorService(NeuronAnchorRepository neuronAnchorRepository,
                         NeuronRepository neuronRepository,
                         ClusterRepository clusterRepository) {
        this.neuronAnchorRepository = neuronAnchorRepository;
        this.neuronRepository = neuronRepository;
        this.clusterRepository = clusterRepository;
    }

    public NeuronAnchorResponse create(CreateNeuronAnchorRequest req, String fileContent) {
        Neuron neuron = neuronRepository.findById(req.neuronId())
                .orElseThrow(() -> new ResourceNotFoundException("Neuron not found: " + req.neuronId()));
        Cluster cluster = clusterRepository.findById(req.clusterId())
                .orElseThrow(() -> new ResourceNotFoundException("Cluster not found: " + req.clusterId()));

        if (neuronAnchorRepository.findByNeuronId(req.neuronId()).isPresent()) {
            throw new ConflictException("Neuron already has an anchor");
        }

        validateLineRange(req.startLine(), req.endLine());

        String anchoredText = extractLines(fileContent, req.startLine(), req.endLine());
        String contentHash = normalizeAndHash(anchoredText);

        NeuronAnchor anchor = new NeuronAnchor();
        anchor.setNeuron(neuron);
        anchor.setCluster(cluster);
        anchor.setFilePath(req.filePath());
        anchor.setStartLine(req.startLine());
        anchor.setEndLine(req.endLine());
        anchor.setContentHash(contentHash);
        anchor.setAnchoredText(anchoredText);
        anchor.setStatus(AnchorStatus.ACTIVE);

        NeuronAnchor saved = neuronAnchorRepository.save(anchor);
        return toResponse(saved);
    }

    public Page<NeuronAnchorResponse> listByCluster(UUID clusterId, Pageable pageable) {
        return neuronAnchorRepository.findByClusterId(clusterId, pageable)
                .map(this::toResponse);
    }

    public Page<NeuronAnchorResponse> listByFile(UUID clusterId, String filePath, Pageable pageable) {
        return neuronAnchorRepository.findByClusterIdAndFilePath(clusterId, filePath, pageable)
                .map(this::toResponse);
    }

    public List<NeuronAnchorResponse> listOrphanedAndDrifted(UUID clusterId) {
        return neuronAnchorRepository.findByClusterIdAndStatusNot(clusterId, AnchorStatus.ACTIVE).stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    public NeuronAnchorResponse update(UUID id, UpdateNeuronAnchorRequest req, String fileContent) {
        NeuronAnchor anchor = neuronAnchorRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Anchor not found: " + id));

        validateLineRange(req.startLine(), req.endLine());

        String anchoredText = extractLines(fileContent, req.startLine(), req.endLine());
        String contentHash = normalizeAndHash(anchoredText);

        anchor.setFilePath(req.filePath());
        anchor.setStartLine(req.startLine());
        anchor.setEndLine(req.endLine());
        anchor.setContentHash(contentHash);
        anchor.setAnchoredText(anchoredText);
        anchor.setStatus(AnchorStatus.ACTIVE);
        anchor.setDriftedStartLine(null);
        anchor.setDriftedEndLine(null);

        NeuronAnchor saved = neuronAnchorRepository.save(anchor);
        return toResponse(saved);
    }

    public void delete(UUID id) {
        NeuronAnchor anchor = neuronAnchorRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Anchor not found: " + id));
        neuronAnchorRepository.delete(anchor);
    }

    public NeuronAnchorResponse confirmDrift(UUID id) {
        NeuronAnchor anchor = neuronAnchorRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Anchor not found: " + id));

        if (anchor.getStatus() != AnchorStatus.DRIFTED) {
            throw new ConflictException("Anchor is not in drifted state");
        }

        if (anchor.getDriftedStartLine() == null || anchor.getDriftedEndLine() == null) {
            throw new ConflictException("Drifted line information is missing");
        }

        anchor.setStartLine(anchor.getDriftedStartLine());
        anchor.setEndLine(anchor.getDriftedEndLine());
        anchor.setDriftedStartLine(null);
        anchor.setDriftedEndLine(null);
        anchor.setStatus(AnchorStatus.ACTIVE);
        // Content hash will be recomputed when file content is available

        NeuronAnchor saved = neuronAnchorRepository.save(anchor);
        return toResponse(saved);
    }

    public NeuronAnchorResponse getByNeuronId(UUID neuronId) {
        return neuronAnchorRepository.findByNeuronId(neuronId)
                .map(this::toResponse)
                .orElse(null);
    }

    public Map<UUID, NeuronAnchorResponse> getByNeuronIds(List<UUID> neuronIds) {
        if (neuronIds == null || neuronIds.isEmpty()) return Map.of();
        return neuronAnchorRepository.findByNeuronIdIn(neuronIds).stream()
                .collect(Collectors.toMap(
                        a -> a.getNeuron() != null ? a.getNeuron().getId() : a.getNeuronId(),
                        this::toResponse
                ));
    }

    // --- Hash normalization ---

    String normalizeAndHash(String text) {
        String normalized = normalize(text);
        return sha256(normalized);
    }

    String normalize(String text) {
        if (text == null || text.isEmpty()) return "";
        String[] lines = text.split("\n", -1);

        // Trim trailing whitespace from each line
        for (int i = 0; i < lines.length; i++) {
            lines[i] = lines[i].stripTrailing();
        }

        // Remove completely blank leading lines
        int start = 0;
        while (start < lines.length && lines[start].isEmpty()) {
            start++;
        }

        // Remove completely blank trailing lines
        int end = lines.length - 1;
        while (end > start && lines[end].isEmpty()) {
            end--;
        }

        if (start > end) return "";

        StringBuilder sb = new StringBuilder();
        for (int i = start; i <= end; i++) {
            if (i > start) sb.append('\n');
            sb.append(lines[i]);
        }
        return sb.toString();
    }

    private void validateLineRange(int startLine, int endLine) {
        if (endLine < startLine) {
            throw new IllegalArgumentException("End line must be >= start line");
        }
        if (endLine - startLine > 100) {
            throw new IllegalArgumentException("Anchor cannot span more than 100 lines");
        }
    }

    private String sha256(String text) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(text.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hash);
        } catch (NoSuchAlgorithmException e) {
            throw new RuntimeException("SHA-256 not available", e);
        }
    }

    private String extractLines(String fileContent, int startLine, int endLine) {
        String[] lines = fileContent.split("\n", -1);
        if (startLine < 1 || endLine > lines.length) {
            throw new IllegalArgumentException("Line range " + startLine + "-" + endLine
                    + " is out of bounds (file has " + lines.length + " lines)");
        }

        StringBuilder sb = new StringBuilder();
        for (int i = startLine - 1; i < endLine; i++) {
            if (i > startLine - 1) sb.append('\n');
            sb.append(lines[i]);
        }
        return sb.toString();
    }

    private NeuronAnchorResponse toResponse(NeuronAnchor anchor) {
        return new NeuronAnchorResponse(
                anchor.getId(),
                anchor.getNeuron() != null ? anchor.getNeuron().getId() : anchor.getNeuronId(),
                anchor.getCluster() != null ? anchor.getCluster().getId() : anchor.getClusterId(),
                anchor.getFilePath(),
                anchor.getStartLine(),
                anchor.getEndLine(),
                anchor.getContentHash(),
                anchor.getCommitSha(),
                anchor.getStatus().getValue(),
                anchor.getDriftedStartLine(),
                anchor.getDriftedEndLine(),
                anchor.getCreatedAt(),
                anchor.getUpdatedAt()
        );
    }
}
