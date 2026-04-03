package com.wliant.brainbook.service;

import com.wliant.brainbook.config.SandboxConfig;
import com.wliant.brainbook.dto.FileContentResponse;
import com.wliant.brainbook.dto.FileTreeEntryResponse;
import com.wliant.brainbook.dto.ProvisionSandboxRequest;
import com.wliant.brainbook.dto.SandboxResponse;
import com.wliant.brainbook.exception.ConflictException;
import com.wliant.brainbook.exception.ResourceNotFoundException;
import com.wliant.brainbook.model.*;
import com.wliant.brainbook.repository.ClusterRepository;
import com.wliant.brainbook.repository.ProjectConfigRepository;
import com.wliant.brainbook.repository.SandboxRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.File;
import java.io.IOException;
import java.net.InetAddress;
import java.net.URI;
import java.net.UnknownHostException;
import java.nio.file.*;
import java.nio.file.attribute.BasicFileAttributes;
import java.util.*;
import java.util.concurrent.Semaphore;
import java.util.concurrent.atomic.AtomicLong;
import java.util.stream.Collectors;
import java.util.stream.Stream;

@Service
@Transactional
public class SandboxService {

    private static final Logger logger = LoggerFactory.getLogger(SandboxService.class);

    private final SandboxRepository sandboxRepository;
    private final ClusterRepository clusterRepository;
    private final ProjectConfigRepository projectConfigRepository;
    private final GitOperationService gitOperationService;
    private final SandboxConfig config;
    private final Semaphore cloneSemaphore;

    public SandboxService(SandboxRepository sandboxRepository,
                          ClusterRepository clusterRepository,
                          ProjectConfigRepository projectConfigRepository,
                          GitOperationService gitOperationService,
                          SandboxConfig config) {
        this.sandboxRepository = sandboxRepository;
        this.clusterRepository = clusterRepository;
        this.projectConfigRepository = projectConfigRepository;
        this.gitOperationService = gitOperationService;
        this.config = config;
        this.cloneSemaphore = new Semaphore(config.getMaxConcurrentClones());
    }

    public SandboxResponse provision(UUID clusterId, ProvisionSandboxRequest req) {
        Cluster cluster = clusterRepository.findById(clusterId)
                .orElseThrow(() -> new ResourceNotFoundException("Cluster not found: " + clusterId));

        if (cluster.getType() != ClusterType.PROJECT) {
            throw new IllegalArgumentException("Only project clusters support sandboxes");
        }

        if (sandboxRepository.findByClusterId(clusterId).isPresent()) {
            throw new ConflictException("Sandbox already exists for cluster: " + clusterId);
        }

        // Quota checks
        long activeCount = sandboxRepository.countByStatusIn(
                List.of(SandboxStatus.CLONING, SandboxStatus.INDEXING, SandboxStatus.ACTIVE));
        if (activeCount >= config.getMaxCount()) {
            throw new ConflictException("Maximum sandbox count reached (" + config.getMaxCount() + ")");
        }

        ProjectConfig projectConfig = projectConfigRepository.findByClusterId(clusterId)
                .orElseThrow(() -> new ResourceNotFoundException("Project config not found for cluster: " + clusterId));

        String repoUrl = projectConfig.getRepoUrl();
        validateRepoUrl(repoUrl);

        String branch = req.branchOrDefault(projectConfig.getDefaultBranch());
        UUID sandboxId = UUID.randomUUID();
        String sandboxPath = Paths.get(config.getRootPath(), sandboxId.toString()).toString();

        Sandbox sandbox = new Sandbox();
        sandbox.setCluster(cluster);
        sandbox.setBrain(cluster.getBrain());
        sandbox.setRepoUrl(repoUrl);
        sandbox.setCurrentBranch(branch);
        sandbox.setSandboxPath(sandboxPath);
        sandbox.setIsShallow(req.isShallow());
        sandbox.setStatus(SandboxStatus.CLONING);

        Sandbox saved = sandboxRepository.save(sandbox);
        asyncClone(saved.getId(), repoUrl, branch, Path.of(sandboxPath, "repo"), req.isShallow());
        return toResponse(saved);
    }

    @Async
    public void asyncClone(UUID sandboxId, String repoUrl, String branch, Path targetDir, boolean shallow) {
        if (!cloneSemaphore.tryAcquire()) {
            sandboxRepository.findById(sandboxId).ifPresent(s -> {
                s.setStatus(SandboxStatus.ERROR);
                s.setErrorMessage("Too many concurrent clones. Please try again later.");
                sandboxRepository.save(s);
            });
            return;
        }

        try {
            gitOperationService.cloneRepository(repoUrl, branch, targetDir, shallow);

            sandboxRepository.findById(sandboxId).ifPresent(s -> {
                s.setStatus(SandboxStatus.ACTIVE);
                try {
                    s.setCurrentCommit(gitOperationService.getHeadCommit(targetDir));
                    s.setDiskUsageBytes(calculateDiskUsage(targetDir));
                } catch (IOException e) {
                    logger.warn("Failed to read head commit after clone", e);
                }
                sandboxRepository.save(s);
            });

            logger.info("Sandbox {} clone complete", sandboxId);
        } catch (Exception e) {
            logger.error("Clone failed for sandbox {}: {}", sandboxId, e.getMessage(), e);
            sandboxRepository.findById(sandboxId).ifPresent(s -> {
                s.setStatus(SandboxStatus.ERROR);
                s.setErrorMessage("Clone failed: " + e.getMessage());
                sandboxRepository.save(s);
            });
            deleteDirectoryQuietly(targetDir.getParent());
        } finally {
            cloneSemaphore.release();
        }
    }

    public void terminate(UUID clusterId) {
        Sandbox sandbox = sandboxRepository.findByClusterId(clusterId)
                .orElseThrow(() -> new ResourceNotFoundException("No sandbox for cluster: " + clusterId));

        sandbox.setStatus(SandboxStatus.TERMINATING);
        sandboxRepository.save(sandbox);

        deleteDirectoryQuietly(Path.of(sandbox.getSandboxPath()));
        sandboxRepository.delete(sandbox);
        logger.info("Sandbox {} terminated for cluster {}", sandbox.getId(), clusterId);
    }

    public void terminateAllForBrain(UUID brainId) {
        List<Sandbox> sandboxes = sandboxRepository.findByBrainId(brainId);
        for (Sandbox s : sandboxes) {
            deleteDirectoryQuietly(Path.of(s.getSandboxPath()));
        }
        sandboxRepository.deleteAll(sandboxes);
    }

    @Transactional(readOnly = true)
    public SandboxResponse getByClusterId(UUID clusterId) {
        Sandbox sandbox = sandboxRepository.findByClusterId(clusterId)
                .orElseThrow(() -> new ResourceNotFoundException("No sandbox for cluster: " + clusterId));
        return toResponse(sandbox);
    }

    @Transactional(readOnly = true)
    public Optional<Sandbox> findByClusterId(UUID clusterId) {
        return sandboxRepository.findByClusterId(clusterId);
    }

    @Transactional(readOnly = true)
    public List<SandboxResponse> getAllActive() {
        return sandboxRepository.findByStatus(SandboxStatus.ACTIVE).stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    public SandboxResponse retry(UUID clusterId) {
        Sandbox sandbox = sandboxRepository.findByClusterId(clusterId)
                .orElseThrow(() -> new ResourceNotFoundException("No sandbox for cluster: " + clusterId));

        if (sandbox.getStatus() != SandboxStatus.ERROR) {
            throw new ConflictException("Can only retry sandboxes in error state");
        }

        deleteDirectoryQuietly(Path.of(sandbox.getSandboxPath()));

        sandbox.setStatus(SandboxStatus.CLONING);
        sandbox.setErrorMessage(null);
        sandboxRepository.save(sandbox);

        Path targetDir = Path.of(sandbox.getSandboxPath(), "repo");
        asyncClone(sandbox.getId(), sandbox.getRepoUrl(), sandbox.getCurrentBranch(), targetDir, sandbox.getIsShallow());
        return toResponse(sandbox);
    }

    public void updateLastAccessed(UUID clusterId) {
        sandboxRepository.findByClusterId(clusterId).ifPresent(s -> {
            s.setLastAccessedAt(java.time.LocalDateTime.now());
            sandboxRepository.save(s);
        });
    }

    public Sandbox requireActiveSandbox(UUID clusterId) {
        Sandbox sandbox = sandboxRepository.findByClusterId(clusterId)
                .orElseThrow(() -> new ResourceNotFoundException("No sandbox for cluster: " + clusterId));
        if (sandbox.getStatus() != SandboxStatus.ACTIVE) {
            throw new ConflictException("Sandbox is not active (status: " + sandbox.getStatus().getValue() + ")");
        }
        return sandbox;
    }

    public List<FileTreeEntryResponse> getFileTree(UUID clusterId, String path) throws IOException {
        Sandbox sandbox = requireActiveSandbox(clusterId);
        Path repoDir = getRepoPath(sandbox);
        Path targetDir = resolveSafePath(repoDir, path);

        List<FileTreeEntryResponse> entries = new ArrayList<>();
        try (Stream<Path> stream = Files.list(targetDir)) {
            stream.forEach(p -> {
                String name = p.getFileName().toString();
                if (name.equals(".git")) return;

                String relativePath = repoDir.relativize(p).toString().replace('\\', '/');
                boolean isDir = Files.isDirectory(p);
                Long size = null;
                if (!isDir) {
                    try { size = Files.size(p); } catch (IOException ignored) {}
                }
                entries.add(new FileTreeEntryResponse(name, relativePath, isDir ? "directory" : "file", size));
            });
        }

        entries.sort((a, b) -> {
            if (!a.type().equals(b.type())) return "directory".equals(a.type()) ? -1 : 1;
            return a.name().compareToIgnoreCase(b.name());
        });
        return entries;
    }

    public FileContentResponse getFileContent(UUID clusterId, String path) throws IOException {
        Sandbox sandbox = requireActiveSandbox(clusterId);
        Path repoDir = getRepoPath(sandbox);
        Path file = resolveSafePath(repoDir, path);

        if (!Files.isRegularFile(file)) {
            throw new ResourceNotFoundException("File not found: " + path);
        }

        long size = Files.size(file);
        if (size > 1_048_576) {
            throw new IllegalArgumentException("File too large to display: " + path + " (" + (size / 1024) + " KB)");
        }

        String content = Files.readString(file);
        String language = UrlBrowseService.detectLanguageStatic(path);
        return new FileContentResponse(path, content, language, size);
    }

    // --- SSRF Prevention ---

    void validateRepoUrl(String repoUrl) {
        if (repoUrl == null || repoUrl.isBlank()) {
            throw new IllegalArgumentException("Repository URL is required");
        }

        URI uri;
        try {
            uri = URI.create(repoUrl);
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException("Invalid repository URL: " + repoUrl);
        }

        String scheme = uri.getScheme();
        if (!"https".equalsIgnoreCase(scheme)) {
            throw new IllegalArgumentException("Only HTTPS repository URLs are allowed. Got: " + scheme);
        }

        String host = uri.getHost();
        if (host == null || host.isBlank()) {
            throw new IllegalArgumentException("Invalid repository URL: missing host");
        }

        // Reject Docker internal hostnames
        if ("host.docker.internal".equalsIgnoreCase(host) || "localhost".equalsIgnoreCase(host)) {
            throw new IllegalArgumentException("Repository URL points to a local address");
        }

        // Resolve and check for private IPs
        try {
            InetAddress[] addresses = InetAddress.getAllByName(host);
            for (InetAddress addr : addresses) {
                if (addr.isLoopbackAddress() || addr.isSiteLocalAddress() || addr.isLinkLocalAddress()) {
                    throw new IllegalArgumentException("Repository URL resolves to a private/local address");
                }
            }
        } catch (UnknownHostException e) {
            throw new IllegalArgumentException("Cannot resolve repository host: " + host);
        }
    }

    // --- Path Safety ---

    private Path getRepoPath(Sandbox sandbox) {
        return Path.of(sandbox.getSandboxPath(), "repo");
    }

    private Path resolveSafePath(Path repoDir, String requestedPath) {
        if (requestedPath == null || requestedPath.isBlank()) {
            return repoDir;
        }
        if (requestedPath.startsWith("/") || requestedPath.contains("..")) {
            throw new SecurityException("Invalid path: " + requestedPath);
        }
        Path resolved = repoDir.resolve(requestedPath).normalize();
        if (!resolved.startsWith(repoDir.normalize())) {
            throw new SecurityException("Path traversal attempt: " + requestedPath);
        }
        return resolved;
    }

    // --- Helpers ---

    private SandboxResponse toResponse(Sandbox sandbox) {
        String brainName = sandbox.getBrain() != null ? sandbox.getBrain().getName() : null;
        String clusterName = sandbox.getCluster() != null ? sandbox.getCluster().getName() : null;
        return new SandboxResponse(
                sandbox.getId(),
                sandbox.getClusterId(),
                sandbox.getBrainId(),
                brainName,
                clusterName,
                sandbox.getRepoUrl(),
                sandbox.getCurrentBranch(),
                sandbox.getCurrentCommit(),
                sandbox.getIsShallow(),
                sandbox.getStatus().getValue(),
                sandbox.getDiskUsageBytes(),
                sandbox.getErrorMessage(),
                sandbox.getLastAccessedAt(),
                sandbox.getCreatedAt(),
                sandbox.getUpdatedAt()
        );
    }

    private long calculateDiskUsage(Path dir) {
        AtomicLong size = new AtomicLong(0);
        try {
            Files.walkFileTree(dir, new SimpleFileVisitor<>() {
                @Override
                public FileVisitResult visitFile(Path file, BasicFileAttributes attrs) {
                    size.addAndGet(attrs.size());
                    return FileVisitResult.CONTINUE;
                }
            });
        } catch (IOException e) {
            logger.warn("Failed to calculate disk usage for {}", dir, e);
        }
        return size.get();
    }

    private void deleteDirectoryQuietly(Path dir) {
        if (dir == null || !Files.exists(dir)) return;
        try {
            Files.walkFileTree(dir, new SimpleFileVisitor<>() {
                @Override
                public FileVisitResult visitFile(Path file, BasicFileAttributes attrs) throws IOException {
                    Files.delete(file);
                    return FileVisitResult.CONTINUE;
                }

                @Override
                public FileVisitResult postVisitDirectory(Path d, IOException exc) throws IOException {
                    Files.delete(d);
                    return FileVisitResult.CONTINUE;
                }
            });
        } catch (IOException e) {
            logger.error("Failed to delete directory: {}", dir, e);
        }
    }
}
