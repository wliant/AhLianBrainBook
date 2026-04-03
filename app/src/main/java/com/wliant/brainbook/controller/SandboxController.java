package com.wliant.brainbook.controller;

import com.wliant.brainbook.dto.*;
import com.wliant.brainbook.model.Sandbox;
import com.wliant.brainbook.service.AnchorService;
import com.wliant.brainbook.service.GitOperationService;
import com.wliant.brainbook.service.IntelligenceService;
import com.wliant.brainbook.service.SandboxService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.io.IOException;
import java.nio.file.Path;
import java.util.List;
import java.util.UUID;

@RestController
public class SandboxController {

    private final SandboxService sandboxService;
    private final GitOperationService gitOperationService;
    private final AnchorService anchorService;
    private final IntelligenceService intelligenceService;

    public SandboxController(SandboxService sandboxService,
                             GitOperationService gitOperationService,
                             AnchorService anchorService,
                             IntelligenceService intelligenceService) {
        this.sandboxService = sandboxService;
        this.gitOperationService = gitOperationService;
        this.anchorService = anchorService;
        this.intelligenceService = intelligenceService;
    }

    // --- Lifecycle ---

    @PostMapping("/api/clusters/{clusterId}/sandbox")
    public ResponseEntity<SandboxResponse> provision(
            @PathVariable UUID clusterId,
            @Valid @RequestBody(required = false) ProvisionSandboxRequest req) {
        if (req == null) req = new ProvisionSandboxRequest(null, null);
        SandboxResponse response = sandboxService.provision(clusterId, req);
        return ResponseEntity.status(HttpStatus.ACCEPTED).body(response);
    }

    @GetMapping("/api/clusters/{clusterId}/sandbox")
    public ResponseEntity<SandboxResponse> get(@PathVariable UUID clusterId) {
        return ResponseEntity.ok(sandboxService.getByClusterId(clusterId));
    }

    @DeleteMapping("/api/clusters/{clusterId}/sandbox")
    public ResponseEntity<Void> terminate(@PathVariable UUID clusterId) {
        sandboxService.terminate(clusterId);
        return ResponseEntity.accepted().build();
    }

    @PostMapping("/api/clusters/{clusterId}/sandbox/retry")
    public ResponseEntity<SandboxResponse> retry(@PathVariable UUID clusterId) {
        return ResponseEntity.accepted().body(sandboxService.retry(clusterId));
    }

    // --- Operations (require active sandbox) ---

    @PostMapping("/api/clusters/{clusterId}/sandbox/pull")
    public ResponseEntity<PullResponse> pull(@PathVariable UUID clusterId) throws Exception {
        Sandbox sandbox = sandboxService.requireActiveSandbox(clusterId);
        sandboxService.updateLastAccessed(clusterId);

        Path repoDir = Path.of(sandbox.getSandboxPath(), "repo");
        String oldCommit = sandbox.getCurrentCommit();
        String newCommit = gitOperationService.pull(repoDir);

        ReconciliationResult result = ReconciliationResult.empty();
        if (oldCommit != null && !oldCommit.equals(newCommit)) {
            List<String> changedFiles = gitOperationService.getChangedFiles(repoDir, oldCommit, newCommit);
            if (!changedFiles.isEmpty()) {
                result = anchorService.reconcile(sandbox.getClusterId(), changedFiles, repoDir);
            }
        }

        sandboxService.updateAfterPull(clusterId, newCommit);

        PullResponse response = new PullResponse(
                newCommit,
                new PullResponse.AnchorsAffected(
                        result.unchanged(), result.autoUpdated(),
                        result.drifted(), result.orphaned()
                )
        );
        return ResponseEntity.ok(response);
    }

    @PostMapping("/api/clusters/{clusterId}/sandbox/checkout")
    public ResponseEntity<SandboxResponse> checkout(
            @PathVariable UUID clusterId,
            @Valid @RequestBody CheckoutRequest req) throws Exception {
        Sandbox sandbox = sandboxService.requireActiveSandbox(clusterId);
        sandboxService.updateLastAccessed(clusterId);

        Path repoDir = Path.of(sandbox.getSandboxPath(), "repo");
        gitOperationService.checkout(repoDir, req.branch());
        String newCommit = gitOperationService.getHeadCommit(repoDir);
        sandboxService.updateAfterCheckout(clusterId, req.branch(), newCommit);

        return ResponseEntity.ok(sandboxService.getByClusterId(clusterId));
    }

    @GetMapping("/api/clusters/{clusterId}/sandbox/branches")
    public ResponseEntity<List<String>> branches(@PathVariable UUID clusterId) throws Exception {
        Sandbox sandbox = sandboxService.requireActiveSandbox(clusterId);
        sandboxService.updateLastAccessed(clusterId);
        Path repoDir = Path.of(sandbox.getSandboxPath(), "repo");
        return ResponseEntity.ok(gitOperationService.listBranches(repoDir));
    }

    @GetMapping("/api/clusters/{clusterId}/sandbox/tree")
    public ResponseEntity<List<FileTreeEntryResponse>> tree(
            @PathVariable UUID clusterId,
            @RequestParam(required = false, defaultValue = "") String path) throws IOException {
        if (!path.isEmpty()) validatePath(path);
        sandboxService.updateLastAccessed(clusterId);
        return ResponseEntity.ok(sandboxService.getFileTree(clusterId, path));
    }

    @GetMapping("/api/clusters/{clusterId}/sandbox/file")
    public ResponseEntity<FileContentResponse> file(
            @PathVariable UUID clusterId,
            @RequestParam String path) throws IOException {
        validatePath(path);
        sandboxService.updateLastAccessed(clusterId);
        return ResponseEntity.ok(sandboxService.getFileContent(clusterId, path));
    }

    @GetMapping("/api/clusters/{clusterId}/sandbox/log")
    public ResponseEntity<List<GitCommitResponse>> log(
            @PathVariable UUID clusterId,
            @RequestParam(defaultValue = "50") int limit,
            @RequestParam(defaultValue = "0") int offset) throws Exception {
        Sandbox sandbox = sandboxService.requireActiveSandbox(clusterId);
        sandboxService.updateLastAccessed(clusterId);
        Path repoDir = Path.of(sandbox.getSandboxPath(), "repo");
        int clampedLimit = Math.min(limit, 200);
        return ResponseEntity.ok(gitOperationService.log(repoDir, clampedLimit, offset));
    }

    @GetMapping("/api/clusters/{clusterId}/sandbox/blame")
    public ResponseEntity<List<BlameLineResponse>> blame(
            @PathVariable UUID clusterId,
            @RequestParam String path) throws Exception {
        Sandbox sandbox = sandboxService.requireActiveSandbox(clusterId);
        sandboxService.updateLastAccessed(clusterId);
        validatePath(path);
        Path repoDir = Path.of(sandbox.getSandboxPath(), "repo");
        return ResponseEntity.ok(gitOperationService.blame(repoDir, path));
    }

    @GetMapping("/api/clusters/{clusterId}/sandbox/diff")
    public ResponseEntity<String> diff(
            @PathVariable UUID clusterId,
            @RequestParam String from,
            @RequestParam String to) throws Exception {
        Sandbox sandbox = sandboxService.requireActiveSandbox(clusterId);
        sandboxService.updateLastAccessed(clusterId);
        Path repoDir = Path.of(sandbox.getSandboxPath(), "repo");
        return ResponseEntity.ok(gitOperationService.diff(repoDir, from, to));
    }

    // --- Code Intelligence (proxy to intelligence service) ---

    @GetMapping("/api/clusters/{clusterId}/sandbox/structure")
    public ResponseEntity<java.util.Map<String, Object>> structure(
            @PathVariable UUID clusterId,
            @RequestParam String path) throws IOException {
        sandboxService.requireActiveSandbox(clusterId);
        sandboxService.updateLastAccessed(clusterId);
        validatePath(path);
        FileContentResponse file = sandboxService.getFileContent(clusterId, path);
        return ResponseEntity.ok(intelligenceService.getCodeStructure(file.content(), file.language()));
    }

    @GetMapping("/api/clusters/{clusterId}/sandbox/definition")
    public ResponseEntity<java.util.Map<String, Object>> definition(
            @PathVariable UUID clusterId,
            @RequestParam String path,
            @RequestParam int line,
            @RequestParam int col) throws IOException {
        sandboxService.requireActiveSandbox(clusterId);
        sandboxService.updateLastAccessed(clusterId);
        validatePath(path);
        FileContentResponse file = sandboxService.getFileContent(clusterId, path);
        return ResponseEntity.ok(intelligenceService.getCodeDefinition(file.content(), file.language(), line, col));
    }

    @GetMapping("/api/clusters/{clusterId}/sandbox/references")
    public ResponseEntity<java.util.Map<String, Object>> references(
            @PathVariable UUID clusterId,
            @RequestParam String path,
            @RequestParam int line,
            @RequestParam int col) throws IOException {
        sandboxService.requireActiveSandbox(clusterId);
        sandboxService.updateLastAccessed(clusterId);
        validatePath(path);
        FileContentResponse file = sandboxService.getFileContent(clusterId, path);
        return ResponseEntity.ok(intelligenceService.getCodeReferences(file.content(), file.language(), line, col));
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
        return ResponseEntity.ok(sandboxService.getAllActive());
    }
}
