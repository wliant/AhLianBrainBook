package com.wliant.brainbook.service;

import com.wliant.brainbook.config.SandboxConfig;
import com.wliant.brainbook.dto.CreateNeuronAnchorRequest;
import com.wliant.brainbook.dto.NeuronAnchorResponse;
import com.wliant.brainbook.dto.ReconciliationResult;
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

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
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

    private static final Logger logger = LoggerFactory.getLogger(AnchorService.class);

    private final NeuronAnchorRepository neuronAnchorRepository;
    private final NeuronRepository neuronRepository;
    private final ClusterRepository clusterRepository;
    private final SandboxConfig sandboxConfig;

    public AnchorService(NeuronAnchorRepository neuronAnchorRepository,
                         NeuronRepository neuronRepository,
                         ClusterRepository clusterRepository,
                         SandboxConfig sandboxConfig) {
        this.neuronAnchorRepository = neuronAnchorRepository;
        this.neuronRepository = neuronRepository;
        this.clusterRepository = clusterRepository;
        this.sandboxConfig = sandboxConfig;
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

    public NeuronAnchorResponse getById(UUID id) {
        NeuronAnchor anchor = neuronAnchorRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Anchor not found: " + id));
        return toResponse(anchor);
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

    // --- Anchor Reconciliation ---

    public ReconciliationResult reconcile(UUID clusterId, List<String> changedFiles, Path repoDir) {
        List<NeuronAnchor> anchors = neuronAnchorRepository.findByClusterIdAndFilePathIn(clusterId, changedFiles);
        if (anchors.isEmpty()) return ReconciliationResult.empty();

        int unchanged = 0, autoUpdated = 0, drifted = 0, orphaned = 0;
        double threshold = sandboxConfig.getFuzzyThreshold();

        for (NeuronAnchor anchor : anchors) {
            try {
                int result = reconcileAnchor(anchor, repoDir, threshold);
                switch (result) {
                    case 0 -> unchanged++;
                    case 1 -> autoUpdated++;
                    case 2 -> drifted++;
                    case 3 -> orphaned++;
                }
            } catch (Exception e) {
                logger.warn("Reconciliation failed for anchor {}: {}", anchor.getId(), e.getMessage());
                anchor.setStatus(AnchorStatus.ORPHANED);
                orphaned++;
            }
            neuronAnchorRepository.save(anchor);
        }

        logger.info("Reconciliation for cluster {}: unchanged={}, autoUpdated={}, drifted={}, orphaned={}",
                clusterId, unchanged, autoUpdated, drifted, orphaned);
        return new ReconciliationResult(unchanged, autoUpdated, drifted, orphaned);
    }

    // Returns: 0=unchanged, 1=autoUpdated, 2=drifted, 3=orphaned
    private int reconcileAnchor(NeuronAnchor anchor, Path repoDir, double threshold) throws IOException {
        Path filePath = repoDir.resolve(anchor.getFilePath());

        // Phase 4 first: check if file exists
        if (!Files.exists(filePath)) {
            anchor.setStatus(AnchorStatus.ORPHANED);
            return 3;
        }

        String fileContent = Files.readString(filePath);

        // Phase 1: Fast hash check at original lines
        String[] lines = fileContent.split("\n", -1);
        if (anchor.getStartLine() <= lines.length && anchor.getEndLine() <= lines.length) {
            String currentText = extractLines(fileContent, anchor.getStartLine(), anchor.getEndLine());
            String currentHash = normalizeAndHash(currentText);
            if (currentHash.equals(anchor.getContentHash())) {
                return 0; // unchanged
            }
        }

        // Phase 2: Exact text search (content shifted)
        String normalizedAnchored = normalize(anchor.getAnchoredText());
        String normalizedFile = normalize(fileContent);
        int anchorLineCount = anchor.getEndLine() - anchor.getStartLine() + 1;

        String[] fileLines = fileContent.split("\n", -1);
        for (int i = 0; i <= fileLines.length - anchorLineCount; i++) {
            StringBuilder window = new StringBuilder();
            for (int j = i; j < i + anchorLineCount; j++) {
                if (j > i) window.append('\n');
                window.append(fileLines[j]);
            }
            if (normalize(window.toString()).equals(normalizedAnchored)) {
                // Exact match at new location — auto-update
                int newStart = i + 1;
                int newEnd = i + anchorLineCount;
                String newText = extractLines(fileContent, newStart, newEnd);
                anchor.setStartLine(newStart);
                anchor.setEndLine(newEnd);
                anchor.setContentHash(normalizeAndHash(newText));
                anchor.setAnchoredText(newText);
                anchor.setStatus(AnchorStatus.ACTIVE);
                anchor.setDriftedStartLine(null);
                anchor.setDriftedEndLine(null);
                return 1; // autoUpdated
            }
        }

        // Phase 3: Fuzzy LCS match
        double bestSimilarity = 0;
        int bestStart = -1;
        for (int i = 0; i <= fileLines.length - anchorLineCount; i++) {
            StringBuilder window = new StringBuilder();
            for (int j = i; j < i + anchorLineCount; j++) {
                if (j > i) window.append('\n');
                window.append(fileLines[j]);
            }
            String windowText = window.toString();
            double similarity = computeSimilarity(anchor.getAnchoredText(), windowText);
            if (similarity > bestSimilarity) {
                bestSimilarity = similarity;
                bestStart = i;
            }
        }

        if (bestSimilarity >= threshold) {
            anchor.setStatus(AnchorStatus.DRIFTED);
            anchor.setDriftedStartLine(bestStart + 1);
            anchor.setDriftedEndLine(bestStart + anchorLineCount);
            return 2; // drifted
        }

        // No match found
        anchor.setStatus(AnchorStatus.ORPHANED);
        return 3; // orphaned
    }

    double computeSimilarity(String a, String b) {
        if (a == null || b == null || a.isEmpty() || b.isEmpty()) return 0;
        int lcsLen = lcsLength(a, b);
        return (double) lcsLen / Math.max(a.length(), b.length());
    }

    int lcsLength(String a, String b) {
        int m = a.length(), n = b.length();
        // Space-optimized LCS: only need two rows
        int[] prev = new int[n + 1];
        int[] curr = new int[n + 1];

        for (int i = 1; i <= m; i++) {
            for (int j = 1; j <= n; j++) {
                if (a.charAt(i - 1) == b.charAt(j - 1)) {
                    curr[j] = prev[j - 1] + 1;
                } else {
                    curr[j] = Math.max(prev[j], curr[j - 1]);
                }
            }
            int[] temp = prev;
            prev = curr;
            curr = temp;
            java.util.Arrays.fill(curr, 0);
        }
        return prev[n];
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
