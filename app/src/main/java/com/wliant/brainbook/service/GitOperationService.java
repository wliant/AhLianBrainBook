package com.wliant.brainbook.service;

import com.wliant.brainbook.dto.BlameLineResponse;
import com.wliant.brainbook.dto.GitCommitResponse;
import org.eclipse.jgit.api.CloneCommand;
import org.eclipse.jgit.api.Git;
import org.eclipse.jgit.api.ListBranchCommand;
import org.eclipse.jgit.api.errors.GitAPIException;
import org.eclipse.jgit.blame.BlameResult;
import org.eclipse.jgit.diff.DiffEntry;
import org.eclipse.jgit.diff.DiffFormatter;
import org.eclipse.jgit.lib.ObjectId;
import org.eclipse.jgit.lib.ObjectReader;
import org.eclipse.jgit.lib.Ref;
import org.eclipse.jgit.lib.Repository;
import org.eclipse.jgit.revwalk.RevCommit;
import org.eclipse.jgit.revwalk.RevWalk;
import org.eclipse.jgit.treewalk.CanonicalTreeParser;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
public class GitOperationService {

    private static final Logger logger = LoggerFactory.getLogger(GitOperationService.class);

    public void cloneRepository(String repoUrl, String branch, Path targetDir, boolean shallow,
                                int timeoutSeconds) throws GitAPIException, IOException {
        logger.info("Cloning {} (branch={}, shallow={}, timeout={}s) to {}",
                repoUrl, branch, shallow, timeoutSeconds, targetDir);

        CloneCommand cmd = Git.cloneRepository()
                .setURI(repoUrl)
                .setDirectory(targetDir.toFile())
                .setBranch(branch)
                .setNoCheckout(false)
                .setCloneSubmodules(false)
                .setTimeout(timeoutSeconds);

        if (shallow) {
            cmd.setDepth(1);
            cmd.setCloneAllBranches(false);
        }

        try (Git git = cmd.call()) {
            // Disable hooks for safety
            git.getRepository().getConfig().setString("core", null, "hooksPath", "/dev/null");
            git.getRepository().getConfig().save();
            logger.info("Clone complete: {}", targetDir);
        }
    }

    public String pull(Path repoDir) throws GitAPIException, IOException {
        try (Git git = Git.open(repoDir.toFile())) {
            git.pull().call();
            return getHeadCommit(git.getRepository());
        }
    }

    public void checkout(Path repoDir, String branch) throws GitAPIException, IOException {
        try (Git git = Git.open(repoDir.toFile())) {
            git.checkout().setName(branch).call();
        }
    }

    public List<String> listBranches(Path repoDir) throws GitAPIException, IOException {
        try (Git git = Git.open(repoDir.toFile())) {
            List<Ref> refs = git.branchList()
                    .setListMode(ListBranchCommand.ListMode.ALL)
                    .call();
            return refs.stream()
                    .map(ref -> {
                        String name = ref.getName();
                        if (name.startsWith("refs/heads/")) return name.substring(11);
                        if (name.startsWith("refs/remotes/origin/")) return name.substring(20);
                        return name;
                    })
                    .distinct()
                    .sorted()
                    .collect(Collectors.toList());
        }
    }

    public List<GitCommitResponse> log(Path repoDir, int limit, int offset)
            throws GitAPIException, IOException {
        try (Git git = Git.open(repoDir.toFile())) {
            Iterable<RevCommit> commits = git.log()
                    .setSkip(offset)
                    .setMaxCount(limit)
                    .call();

            List<GitCommitResponse> result = new ArrayList<>();
            for (RevCommit commit : commits) {
                result.add(new GitCommitResponse(
                        commit.getName(),
                        commit.getAuthorIdent().getName(),
                        commit.getAuthorIdent().getEmailAddress(),
                        toLocalDateTime(commit.getAuthorIdent().getWhenAsInstant()),
                        commit.getShortMessage()
                ));
            }
            return result;
        }
    }

    public List<BlameLineResponse> blame(Path repoDir, String filePath)
            throws GitAPIException, IOException {
        try (Git git = Git.open(repoDir.toFile())) {
            BlameResult blameResult = git.blame()
                    .setFilePath(filePath)
                    .call();

            if (blameResult == null) {
                return List.of();
            }

            int lineCount = blameResult.getResultContents().size();
            List<BlameLineResponse> result = new ArrayList<>(lineCount);
            for (int i = 0; i < lineCount; i++) {
                RevCommit commit = blameResult.getSourceCommit(i);
                result.add(new BlameLineResponse(
                        i + 1,
                        commit != null ? commit.getName() : null,
                        commit != null ? commit.getAuthorIdent().getName() : null,
                        commit != null ? toLocalDateTime(commit.getAuthorIdent().getWhenAsInstant()) : null,
                        blameResult.getResultContents().getString(i)
                ));
            }
            return result;
        }
    }

    public String diff(Path repoDir, String fromRef, String toRef)
            throws GitAPIException, IOException {
        try (Git git = Git.open(repoDir.toFile())) {
            Repository repo = git.getRepository();
            ObjectId fromId = repo.resolve(fromRef);
            ObjectId toId = repo.resolve(toRef);

            if (fromId == null || toId == null) {
                throw new IllegalArgumentException("Invalid ref: " +
                        (fromId == null ? fromRef : toRef));
            }

            ByteArrayOutputStream out = new ByteArrayOutputStream();
            try (DiffFormatter formatter = new DiffFormatter(out);
                 ObjectReader reader = repo.newObjectReader();
                 RevWalk walk = new RevWalk(repo)) {

                formatter.setRepository(repo);
                formatter.setDetectRenames(true);

                RevCommit fromCommit = walk.parseCommit(fromId);
                RevCommit toCommit = walk.parseCommit(toId);

                CanonicalTreeParser oldTree = new CanonicalTreeParser();
                oldTree.reset(reader, fromCommit.getTree());
                CanonicalTreeParser newTree = new CanonicalTreeParser();
                newTree.reset(reader, toCommit.getTree());

                List<DiffEntry> diffs = formatter.scan(oldTree, newTree);
                for (DiffEntry entry : diffs) {
                    formatter.format(entry);
                }
            }
            return out.toString(StandardCharsets.UTF_8);
        }
    }

    public List<String> getChangedFiles(Path repoDir, String fromCommit, String toCommit)
            throws IOException {
        try (Git git = Git.open(repoDir.toFile())) {
            Repository repo = git.getRepository();
            ObjectId fromId = repo.resolve(fromCommit);
            ObjectId toId = repo.resolve(toCommit);

            if (fromId == null || toId == null) {
                return List.of();
            }

            try (ObjectReader reader = repo.newObjectReader();
                 RevWalk walk = new RevWalk(repo);
                 DiffFormatter formatter = new DiffFormatter(ByteArrayOutputStream.nullOutputStream())) {

                formatter.setRepository(repo);
                formatter.setDetectRenames(true);

                RevCommit from = walk.parseCommit(fromId);
                RevCommit to = walk.parseCommit(toId);

                CanonicalTreeParser oldTree = new CanonicalTreeParser();
                oldTree.reset(reader, from.getTree());
                CanonicalTreeParser newTree = new CanonicalTreeParser();
                newTree.reset(reader, to.getTree());

                List<DiffEntry> diffs = formatter.scan(oldTree, newTree);
                List<String> files = new ArrayList<>();
                for (DiffEntry entry : diffs) {
                    if (entry.getNewPath() != null && !"/dev/null".equals(entry.getNewPath())) {
                        files.add(entry.getNewPath());
                    }
                    if (entry.getOldPath() != null && !"/dev/null".equals(entry.getOldPath())
                            && !entry.getOldPath().equals(entry.getNewPath())) {
                        files.add(entry.getOldPath());
                    }
                }
                return files.stream().distinct().collect(Collectors.toList());
            }
        }
    }

    public Map<String, String> getFileRenames(Path repoDir, String fromCommit, String toCommit)
            throws IOException {
        try (Git git = Git.open(repoDir.toFile())) {
            Repository repo = git.getRepository();
            ObjectId fromId = repo.resolve(fromCommit);
            ObjectId toId = repo.resolve(toCommit);

            if (fromId == null || toId == null) {
                return Map.of();
            }

            try (ObjectReader reader = repo.newObjectReader();
                 RevWalk walk = new RevWalk(repo);
                 DiffFormatter formatter = new DiffFormatter(ByteArrayOutputStream.nullOutputStream())) {

                formatter.setRepository(repo);
                formatter.setDetectRenames(true);

                RevCommit from = walk.parseCommit(fromId);
                RevCommit to = walk.parseCommit(toId);

                CanonicalTreeParser oldTree = new CanonicalTreeParser();
                oldTree.reset(reader, from.getTree());
                CanonicalTreeParser newTree = new CanonicalTreeParser();
                newTree.reset(reader, to.getTree());

                List<DiffEntry> diffs = formatter.scan(oldTree, newTree);
                Map<String, String> renames = new java.util.HashMap<>();
                for (DiffEntry entry : diffs) {
                    if (entry.getChangeType() == DiffEntry.ChangeType.RENAME) {
                        renames.put(entry.getOldPath(), entry.getNewPath());
                    }
                }
                return renames;
            }
        }
    }

    public String getHeadCommit(Path repoDir) throws IOException {
        try (Git git = Git.open(repoDir.toFile())) {
            return getHeadCommit(git.getRepository());
        }
    }

    public String readFileContent(Path repoDir, String filePath) throws IOException {
        Path file = repoDir.resolve(filePath).normalize();
        if (!file.startsWith(repoDir.normalize())) {
            throw new SecurityException("Path traversal attempt: " + filePath);
        }
        return Files.readString(file, StandardCharsets.UTF_8);
    }

    private String getHeadCommit(Repository repo) throws IOException {
        ObjectId head = repo.resolve("HEAD");
        return head != null ? head.getName() : null;
    }

    private LocalDateTime toLocalDateTime(Instant instant) {
        return instant != null
                ? LocalDateTime.ofInstant(instant, ZoneId.systemDefault())
                : null;
    }
}
