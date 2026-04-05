package com.wliant.brainbook.controller;

import com.wliant.brainbook.config.SandboxGrpcClient;
import com.wliant.brainbook.dto.*;
import com.wliant.brainbook.exception.ResourceNotFoundException;
import com.wliant.brainbook.model.Cluster;
import com.wliant.brainbook.model.ClusterType;
import com.wliant.brainbook.model.ProjectConfig;
import com.wliant.brainbook.repository.ClusterRepository;
import com.wliant.brainbook.repository.ProjectConfigRepository;
import com.wliant.brainbook.sandbox.grpc.GetBlameResponse;
import com.wliant.brainbook.sandbox.grpc.GetDiffResponse;
import com.wliant.brainbook.sandbox.grpc.GetFileContentResponse;
import com.wliant.brainbook.sandbox.grpc.GetFileTreeResponse;
import com.wliant.brainbook.sandbox.grpc.GetLogResponse;
import com.wliant.brainbook.sandbox.grpc.ListActiveResponse;
import com.wliant.brainbook.sandbox.grpc.ListBranchesResponse;
import com.wliant.brainbook.sandbox.grpc.SandboxInfo;
import com.wliant.brainbook.service.IntelligenceService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@RestController
@Transactional(readOnly = true)
public class SandboxController {

    private final SandboxGrpcClient grpcClient;
    private final ClusterRepository clusterRepository;
    private final ProjectConfigRepository projectConfigRepository;
    private final IntelligenceService intelligenceService;

    public SandboxController(SandboxGrpcClient grpcClient,
                             ClusterRepository clusterRepository,
                             ProjectConfigRepository projectConfigRepository,
                             IntelligenceService intelligenceService) {
        this.grpcClient = grpcClient;
        this.clusterRepository = clusterRepository;
        this.projectConfigRepository = projectConfigRepository;
        this.intelligenceService = intelligenceService;
    }

    // --- Lifecycle ---

    @PostMapping("/api/clusters/{clusterId}/sandbox")
    public ResponseEntity<SandboxResponse> provision(
            @PathVariable UUID clusterId,
            @Valid @RequestBody(required = false) ProvisionSandboxRequest req) {
        if (req == null) req = new ProvisionSandboxRequest(null, null);

        Cluster cluster = clusterRepository.findById(clusterId)
                .orElseThrow(() -> new ResourceNotFoundException("Cluster not found: " + clusterId));
        if (cluster.getType() != ClusterType.PROJECT) {
            throw new IllegalArgumentException("Only project clusters support sandboxes");
        }

        ProjectConfig config = projectConfigRepository.findByClusterId(clusterId)
                .orElseThrow(() -> new ResourceNotFoundException("Project config not found for cluster: " + clusterId));

        String branch = req.branchOrDefault(config.getDefaultBranch());
        SandboxInfo info = grpcClient.provision(
                clusterId, cluster.getBrainId(), config.getRepoUrl(), branch, req.isShallow());

        return ResponseEntity.status(HttpStatus.ACCEPTED).body(toResponse(info, cluster));
    }

    @GetMapping("/api/clusters/{clusterId}/sandbox")
    public ResponseEntity<SandboxResponse> get(@PathVariable UUID clusterId) {
        SandboxInfo info = grpcClient.getStatus(clusterId);
        Cluster cluster = findCluster(clusterId);
        return ResponseEntity.ok(toResponse(info, cluster));
    }

    @DeleteMapping("/api/clusters/{clusterId}/sandbox")
    public ResponseEntity<Void> terminate(@PathVariable UUID clusterId) {
        grpcClient.terminate(clusterId);
        return ResponseEntity.accepted().build();
    }

    @PostMapping("/api/clusters/{clusterId}/sandbox/retry")
    public ResponseEntity<SandboxResponse> retry(@PathVariable UUID clusterId) {
        SandboxInfo info = grpcClient.retry(clusterId);
        Cluster cluster = findCluster(clusterId);
        return ResponseEntity.accepted().body(toResponse(info, cluster));
    }

    // --- Operations (require active sandbox) ---

    @PostMapping("/api/clusters/{clusterId}/sandbox/pull")
    public ResponseEntity<com.wliant.brainbook.dto.PullResponse> pull(@PathVariable UUID clusterId) {
        com.wliant.brainbook.sandbox.grpc.PullResponse grpcResp = grpcClient.pull(clusterId);
        return ResponseEntity.ok(new com.wliant.brainbook.dto.PullResponse(grpcResp.getNewCommit()));
    }

    @PostMapping("/api/clusters/{clusterId}/sandbox/checkout")
    public ResponseEntity<SandboxResponse> checkout(
            @PathVariable UUID clusterId,
            @Valid @RequestBody com.wliant.brainbook.dto.CheckoutRequest req) {
        SandboxInfo info = grpcClient.checkout(clusterId, req.branch());
        Cluster cluster = findCluster(clusterId);
        return ResponseEntity.ok(toResponse(info, cluster));
    }

    @GetMapping("/api/clusters/{clusterId}/sandbox/branches")
    public ResponseEntity<List<String>> branches(@PathVariable UUID clusterId) {
        ListBranchesResponse resp = grpcClient.listBranches(clusterId);
        return ResponseEntity.ok(resp.getBranchesList());
    }

    @GetMapping("/api/clusters/{clusterId}/sandbox/tree")
    public ResponseEntity<List<FileTreeEntryResponse>> tree(
            @PathVariable UUID clusterId,
            @RequestParam(required = false, defaultValue = "") String path) {
        if (!path.isEmpty()) validatePath(path);
        GetFileTreeResponse resp = grpcClient.getFileTree(clusterId, path);
        List<FileTreeEntryResponse> entries = resp.getEntriesList().stream()
                .map(e -> new FileTreeEntryResponse(e.getName(), e.getPath(), e.getType(),
                        "directory".equals(e.getType()) ? null : e.getSize()))
                .collect(Collectors.toList());
        return ResponseEntity.ok(entries);
    }

    @GetMapping("/api/clusters/{clusterId}/sandbox/file")
    public ResponseEntity<FileContentResponse> file(
            @PathVariable UUID clusterId,
            @RequestParam String path) {
        validatePath(path);
        GetFileContentResponse resp = grpcClient.getFileContent(clusterId, path);
        String encoding = resp.getEncoding().isEmpty() ? "utf-8" : resp.getEncoding();
        return ResponseEntity.ok(new FileContentResponse(resp.getPath(), resp.getContent(), resp.getLanguage(), resp.getSize(), encoding));
    }

    @GetMapping("/api/clusters/{clusterId}/sandbox/log")
    public ResponseEntity<List<GitCommitResponse>> log(
            @PathVariable UUID clusterId,
            @RequestParam(defaultValue = "50") int limit,
            @RequestParam(defaultValue = "0") int offset) {
        int clampedLimit = Math.min(limit, 200);
        GetLogResponse resp = grpcClient.getLog(clusterId, clampedLimit, offset);
        List<GitCommitResponse> commits = resp.getCommitsList().stream()
                .map(c -> new GitCommitResponse(
                        c.getSha(), c.getAuthor(), c.getAuthorEmail(),
                        toLocalDateTime(c.getDate()),
                        c.getMessage()))
                .collect(Collectors.toList());
        return ResponseEntity.ok(commits);
    }

    @GetMapping("/api/clusters/{clusterId}/sandbox/blame")
    public ResponseEntity<List<BlameLineResponse>> blame(
            @PathVariable UUID clusterId,
            @RequestParam String path) {
        validatePath(path);
        GetBlameResponse resp = grpcClient.getBlame(clusterId, path);
        List<BlameLineResponse> lines = resp.getLinesList().stream()
                .map(l -> new BlameLineResponse(
                        l.getLine(), l.getCommitSha(), l.getAuthor(),
                        toLocalDateTime(l.getDate()),
                        l.getContent()))
                .collect(Collectors.toList());
        return ResponseEntity.ok(lines);
    }

    @GetMapping("/api/clusters/{clusterId}/sandbox/diff")
    public ResponseEntity<String> diff(
            @PathVariable UUID clusterId,
            @RequestParam String from,
            @RequestParam String to) {
        GetDiffResponse resp = grpcClient.getDiff(clusterId, from, to);
        return ResponseEntity.ok(resp.getUnifiedDiff());
    }

    // --- Code Intelligence (proxy: sandbox-service for file, intelligence-service for analysis) ---

    @GetMapping("/api/clusters/{clusterId}/sandbox/structure")
    public ResponseEntity<Map<String, Object>> structure(
            @PathVariable UUID clusterId,
            @RequestParam String path) {
        validatePath(path);
        GetFileContentResponse file = grpcClient.getFileContent(clusterId, path);
        return ResponseEntity.ok(intelligenceService.getCodeStructure(file.getContent(), file.getLanguage()));
    }

    @GetMapping("/api/clusters/{clusterId}/sandbox/definition")
    public ResponseEntity<Map<String, Object>> definition(
            @PathVariable UUID clusterId,
            @RequestParam String path,
            @RequestParam int line,
            @RequestParam int col) {
        validatePath(path);
        GetFileContentResponse file = grpcClient.getFileContent(clusterId, path);
        return ResponseEntity.ok(intelligenceService.getCodeDefinition(file.getContent(), file.getLanguage(), line, col));
    }

    @GetMapping("/api/clusters/{clusterId}/sandbox/references")
    public ResponseEntity<Map<String, Object>> references(
            @PathVariable UUID clusterId,
            @RequestParam String path,
            @RequestParam int line,
            @RequestParam int col) {
        validatePath(path);
        GetFileContentResponse file = grpcClient.getFileContent(clusterId, path);
        return ResponseEntity.ok(intelligenceService.getCodeReferences(file.getContent(), file.getLanguage(), line, col));
    }

    private void validatePath(String path) {
        if (path == null || path.isBlank()) {
            throw new IllegalArgumentException("Path is required");
        }
        if (path.contains("..") || path.startsWith("/") || path.equals(".git") || path.startsWith(".git/")) {
            throw new IllegalArgumentException("Invalid path: " + path);
        }
    }

    // --- Global listing (for sidebar) ---

    @GetMapping("/api/sandboxes")
    public ResponseEntity<List<SandboxResponse>> listAll() {
        ListActiveResponse resp = grpcClient.listActive();
        List<SandboxResponse> sandboxes = resp.getSandboxesList().stream()
                .map(info -> {
                    Cluster cluster = clusterRepository.findById(UUID.fromString(info.getClusterId())).orElse(null);
                    return toResponse(info, cluster);
                })
                .collect(Collectors.toList());
        return ResponseEntity.ok(sandboxes);
    }

    // --- Helpers ---

    private Cluster findCluster(UUID clusterId) {
        return clusterRepository.findById(clusterId).orElse(null);
    }

    private SandboxResponse toResponse(SandboxInfo info, Cluster cluster) {
        String brainName = cluster != null && cluster.getBrain() != null ? cluster.getBrain().getName() : null;
        String clusterName = cluster != null ? cluster.getName() : null;
        return new SandboxResponse(
                UUID.fromString(info.getId()),
                UUID.fromString(info.getClusterId()),
                UUID.fromString(info.getBrainId()),
                brainName,
                clusterName,
                info.getRepoUrl(),
                info.getCurrentBranch(),
                info.getCurrentCommit().isEmpty() ? null : info.getCurrentCommit(),
                info.getIsShallow(),
                info.getStatus(),
                info.getDiskUsageBytes() > 0 ? info.getDiskUsageBytes() : null,
                info.getErrorMessage().isEmpty() ? null : info.getErrorMessage(),
                toLocalDateTime(info.getLastAccessedAt()),
                toLocalDateTime(info.getCreatedAt()),
                toLocalDateTime(info.getUpdatedAt())
        );
    }

    private LocalDateTime toLocalDateTime(com.google.protobuf.Timestamp ts) {
        if (ts == null || (ts.getSeconds() == 0 && ts.getNanos() == 0)) return null;
        return LocalDateTime.ofInstant(Instant.ofEpochSecond(ts.getSeconds(), ts.getNanos()), ZoneOffset.UTC);
    }
}
