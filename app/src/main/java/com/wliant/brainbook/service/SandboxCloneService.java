package com.wliant.brainbook.service;

import com.wliant.brainbook.config.SandboxConfig;
import com.wliant.brainbook.model.SandboxStatus;
import com.wliant.brainbook.repository.SandboxRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.IOException;
import java.nio.file.FileVisitResult;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.SimpleFileVisitor;
import java.nio.file.attribute.BasicFileAttributes;
import java.util.UUID;
import java.util.concurrent.Semaphore;
import java.util.concurrent.atomic.AtomicLong;

@Service
public class SandboxCloneService {

    private static final Logger logger = LoggerFactory.getLogger(SandboxCloneService.class);

    private final SandboxRepository sandboxRepository;
    private final GitOperationService gitOperationService;
    private final SandboxConfig config;
    private final Semaphore cloneSemaphore;

    public SandboxCloneService(SandboxRepository sandboxRepository,
                               GitOperationService gitOperationService,
                               SandboxConfig config) {
        this.sandboxRepository = sandboxRepository;
        this.gitOperationService = gitOperationService;
        this.config = config;
        this.cloneSemaphore = new Semaphore(config.getMaxConcurrentClones());
    }

    @Async
    @Transactional
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
            gitOperationService.cloneRepository(repoUrl, branch, targetDir, shallow,
                    config.getCloneTimeoutSec());

            long diskUsage = calculateDiskUsage(targetDir);
            if (diskUsage > config.getMaxRepoSizeBytes()) {
                logger.warn("Sandbox {} exceeds max repo size ({} MB > {} MB), removing",
                        sandboxId, diskUsage / (1024 * 1024), config.getMaxRepoSizeMb());
                deleteDirectoryQuietly(targetDir.getParent());
                sandboxRepository.findById(sandboxId).ifPresent(s -> {
                    s.setStatus(SandboxStatus.ERROR);
                    s.setErrorMessage("Repository exceeds size limit ("
                            + (diskUsage / (1024 * 1024)) + " MB > " + config.getMaxRepoSizeMb() + " MB)");
                    sandboxRepository.save(s);
                });
                return;
            }

            sandboxRepository.findById(sandboxId).ifPresent(s -> {
                s.setStatus(SandboxStatus.ACTIVE);
                try {
                    s.setCurrentCommit(gitOperationService.getHeadCommit(targetDir));
                } catch (IOException e) {
                    logger.warn("Failed to read head commit after clone", e);
                }
                s.setDiskUsageBytes(diskUsage);
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
