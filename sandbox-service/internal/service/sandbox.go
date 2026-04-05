package service

import (
	"context"
	"fmt"
	"io/fs"
	"log/slog"
	"os"
	"path/filepath"
	"strings"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"brainbook/sandbox-service/internal/config"
	"brainbook/sandbox-service/internal/model"
	"brainbook/sandbox-service/internal/store"
)

type SandboxService struct {
	store      *store.Store
	git        *GitService
	config     *config.Config
	sem        chan struct{}    // clone concurrency semaphore
	shutdownCtx context.Context // cancelled on graceful shutdown
}

func NewSandboxService(shutdownCtx context.Context, st *store.Store, git *GitService, cfg *config.Config) *SandboxService {
	return &SandboxService{
		store:      st,
		git:        git,
		config:     cfg,
		sem:        make(chan struct{}, cfg.MaxConcurrentClones),
		shutdownCtx: shutdownCtx,
	}
}

func (s *SandboxService) Provision(ctx context.Context, clusterID, brainID uuid.UUID, repoURL, branch string, shallow bool) (*model.Sandbox, error) {
	// Check if sandbox already exists
	existing, err := s.store.GetByClusterID(ctx, clusterID)
	if err == nil && existing != nil {
		return nil, fmt.Errorf("sandbox already exists for cluster: %s", clusterID)
	}

	// SSRF validation
	if err := ValidateRepoURL(repoURL); err != nil {
		return nil, err
	}

	// Quota: max count
	count, err := s.store.CountByStatuses(ctx, []string{model.StatusCloning, model.StatusIndexing, model.StatusActive})
	if err != nil {
		return nil, fmt.Errorf("quota check failed: %w", err)
	}
	if count >= int64(s.config.MaxCount) {
		return nil, fmt.Errorf("maximum sandbox count reached (%d)", s.config.MaxCount)
	}

	// Quota: max total disk
	totalDisk, err := s.store.SumDiskUsageActive(ctx)
	if err != nil {
		return nil, fmt.Errorf("disk quota check failed: %w", err)
	}
	if totalDisk >= s.config.MaxTotalDiskBytes() {
		return nil, fmt.Errorf("total sandbox disk quota exceeded (%d MB / %d MB)", totalDisk/(1024*1024), s.config.MaxTotalDiskMB)
	}

	if branch == "" {
		branch = "main"
	}

	// Insert sandbox record
	sb, err := s.store.Insert(ctx, clusterID, brainID, repoURL, branch, "", shallow)
	if err != nil {
		return nil, fmt.Errorf("failed to create sandbox: %w", err)
	}

	// Set sandbox path now that we have the ID
	sandboxPath := filepath.Join(s.config.SandboxRootPath, sb.ID.String())
	sb.SandboxPath = sandboxPath
	if err := s.store.UpdateSandboxPath(ctx, sb.ID, sandboxPath); err != nil {
		return nil, fmt.Errorf("failed to set sandbox path: %w", err)
	}

	// Start async clone
	s.startClone(sb.ID, repoURL, branch, filepath.Join(sandboxPath, "repo"), shallow)

	return sb, nil
}

func (s *SandboxService) startClone(sandboxID uuid.UUID, repoURL, branch, targetDir string, shallow bool) {
	select {
	case s.sem <- struct{}{}:
		go func() {
			defer func() { <-s.sem }()
			s.doClone(sandboxID, repoURL, branch, targetDir, shallow)
		}()
	default:
		ctx := s.shutdownCtx
		if err := s.store.UpdateStatusWithError(ctx, sandboxID, model.StatusError,
			"Too many concurrent clones. Please try again later."); err != nil {
			slog.Error("failed to set error status", "id", sandboxID, "error", err)
		}
	}
}

func (s *SandboxService) doClone(sandboxID uuid.UUID, repoURL, branch, targetDir string, shallow bool) {
	ctx := s.shutdownCtx

	// Create parent directory
	parentDir := filepath.Dir(targetDir)
	if err := os.MkdirAll(parentDir, 0755); err != nil {
		slog.Error("failed to create sandbox dir", "id", sandboxID, "error", err)
		if dbErr := s.store.UpdateStatusWithError(ctx, sandboxID, model.StatusError, "Failed to create directory: "+err.Error()); dbErr != nil {
			slog.Error("failed to set error status", "id", sandboxID, "error", dbErr)
		}
		return
	}

	// Clone
	err := s.git.Clone(ctx, repoURL, branch, targetDir, shallow, s.config.CloneTimeoutSec)
	if err != nil {
		slog.Error("clone failed", "id", sandboxID, "error", err)
		if dbErr := s.store.UpdateStatusWithError(ctx, sandboxID, model.StatusError, err.Error()); dbErr != nil {
			slog.Error("failed to set error status", "id", sandboxID, "error", dbErr)
		}
		deleteDirectoryQuietly(parentDir, s.config.SandboxRootPath)
		return
	}

	// Calculate disk usage
	diskUsage := calculateDiskUsage(parentDir)

	// Check repo size limit
	if diskUsage > s.config.MaxRepoSizeBytes() {
		slog.Warn("repo too large", "id", sandboxID, "size_mb", diskUsage/(1024*1024))
		if dbErr := s.store.UpdateStatusWithError(ctx, sandboxID, model.StatusError,
			fmt.Sprintf("Repository too large: %d MB (limit %d MB)", diskUsage/(1024*1024), s.config.MaxRepoSizeMB)); dbErr != nil {
			slog.Error("failed to set error status", "id", sandboxID, "error", dbErr)
		}
		deleteDirectoryQuietly(parentDir, s.config.SandboxRootPath)
		return
	}

	// Get HEAD commit
	commit, err := s.git.HeadCommit(ctx, targetDir)
	if err != nil {
		slog.Warn("failed to read HEAD", "id", sandboxID, "error", err)
		commit = ""
	}

	// Update DB to active
	if err := s.store.UpdateAfterClone(ctx, sandboxID, commit, diskUsage); err != nil {
		slog.Error("failed to update sandbox after clone", "id", sandboxID, "error", err)
		return
	}

	slog.Info("sandbox ready", "id", sandboxID, "disk_mb", diskUsage/(1024*1024))
}

func (s *SandboxService) GetByClusterID(ctx context.Context, clusterID uuid.UUID) (*model.Sandbox, error) {
	sb, err := s.store.GetByClusterID(ctx, clusterID)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, fmt.Errorf("no sandbox for cluster: %s", clusterID)
		}
		return nil, err
	}
	return sb, nil
}

func (s *SandboxService) RequireActive(ctx context.Context, clusterID uuid.UUID) (*model.Sandbox, error) {
	sb, err := s.GetByClusterID(ctx, clusterID)
	if err != nil {
		return nil, err
	}
	if sb.Status != model.StatusActive {
		return nil, fmt.Errorf("sandbox is not active (status: %s)", sb.Status)
	}
	return sb, nil
}

func (s *SandboxService) Terminate(ctx context.Context, clusterID uuid.UUID) error {
	sb, err := s.GetByClusterID(ctx, clusterID)
	if err != nil {
		return err
	}

	_ = s.store.UpdateStatus(ctx, sb.ID, model.StatusTerminating)
	deleteDirectoryQuietly(sb.SandboxPath, s.config.SandboxRootPath)
	if err := s.store.Delete(ctx, sb.ID); err != nil {
		return fmt.Errorf("failed to delete sandbox: %w", err)
	}

	slog.Info("sandbox terminated", "id", sb.ID, "cluster_id", clusterID)
	return nil
}

func (s *SandboxService) TerminateByBrain(ctx context.Context, brainID uuid.UUID) (int32, error) {
	sandboxes, err := s.store.ListByBrainID(ctx, brainID)
	if err != nil {
		return 0, err
	}

	var count int32
	for _, sb := range sandboxes {
		deleteDirectoryQuietly(sb.SandboxPath, s.config.SandboxRootPath)
		count++
	}

	_, err = s.store.DeleteByBrainID(ctx, brainID)
	if err != nil {
		return count, err
	}
	return count, nil
}

func (s *SandboxService) Retry(ctx context.Context, clusterID uuid.UUID) (*model.Sandbox, error) {
	sb, err := s.GetByClusterID(ctx, clusterID)
	if err != nil {
		return nil, err
	}
	if sb.Status != model.StatusError {
		return nil, fmt.Errorf("can only retry sandboxes in error state (status: %s)", sb.Status)
	}

	deleteDirectoryQuietly(sb.SandboxPath, s.config.SandboxRootPath)

	if err := s.store.ClearErrorAndSetCloning(ctx, sb.ID); err != nil {
		return nil, err
	}
	sb.Status = model.StatusCloning
	sb.ErrorMessage = nil

	s.startClone(sb.ID, sb.RepoURL, sb.CurrentBranch, filepath.Join(sb.SandboxPath, "repo"), sb.IsShallow)
	return sb, nil
}

func (s *SandboxService) ListActive(ctx context.Context) ([]*model.Sandbox, error) {
	return s.store.ListActive(ctx)
}

func (s *SandboxService) Pull(ctx context.Context, clusterID uuid.UUID) (string, error) {
	sb, err := s.RequireActive(ctx, clusterID)
	if err != nil {
		return "", err
	}

	repoDir := filepath.Join(sb.SandboxPath, "repo")
	newCommit, err := s.git.Pull(ctx, repoDir)
	if err != nil {
		return "", err
	}

	if err := s.store.UpdateAfterPull(ctx, sb.ID, newCommit); err != nil {
		slog.Error("failed to update sandbox after pull", "id", sb.ID, "error", err)
	}
	return newCommit, nil
}

func (s *SandboxService) Checkout(ctx context.Context, clusterID uuid.UUID, branch string) (*model.Sandbox, error) {
	sb, err := s.RequireActive(ctx, clusterID)
	if err != nil {
		return nil, err
	}

	repoDir := filepath.Join(sb.SandboxPath, "repo")
	if err := s.git.Checkout(ctx, repoDir, branch); err != nil {
		return nil, err
	}

	commit, err := s.git.HeadCommit(ctx, repoDir)
	if err != nil {
		return nil, err
	}

	if err := s.store.UpdateAfterCheckout(ctx, sb.ID, branch, commit); err != nil {
		slog.Error("failed to update sandbox after checkout", "id", sb.ID, "error", err)
	}

	sb.CurrentBranch = branch
	if commit != "" {
		sb.CurrentCommit = &commit
	}
	return sb, nil
}

func (s *SandboxService) ListBranches(ctx context.Context, clusterID uuid.UUID) ([]string, error) {
	sb, err := s.RequireActive(ctx, clusterID)
	if err != nil {
		return nil, err
	}
	_ = s.store.UpdateLastAccessed(ctx, sb.ID)
	return s.git.ListBranches(ctx, filepath.Join(sb.SandboxPath, "repo"))
}

func (s *SandboxService) GetLog(ctx context.Context, clusterID uuid.UUID, limit, offset int) ([]CommitInfo, error) {
	sb, err := s.RequireActive(ctx, clusterID)
	if err != nil {
		return nil, err
	}
	_ = s.store.UpdateLastAccessed(ctx, sb.ID)
	return s.git.Log(ctx, filepath.Join(sb.SandboxPath, "repo"), limit, offset)
}

func (s *SandboxService) GetBlame(ctx context.Context, clusterID uuid.UUID, path string) ([]BlameLineInfo, error) {
	sb, err := s.RequireActive(ctx, clusterID)
	if err != nil {
		return nil, err
	}
	_ = s.store.UpdateLastAccessed(ctx, sb.ID)
	return s.git.Blame(ctx, filepath.Join(sb.SandboxPath, "repo"), path)
}

func (s *SandboxService) GetDiff(ctx context.Context, clusterID uuid.UUID, fromRef, toRef string) (string, error) {
	sb, err := s.RequireActive(ctx, clusterID)
	if err != nil {
		return "", err
	}
	_ = s.store.UpdateLastAccessed(ctx, sb.ID)
	return s.git.Diff(ctx, filepath.Join(sb.SandboxPath, "repo"), fromRef, toRef)
}

func (s *SandboxService) GetFileTree(ctx context.Context, clusterID uuid.UUID, path string) ([]FileTreeEntry, error) {
	sb, err := s.RequireActive(ctx, clusterID)
	if err != nil {
		return nil, err
	}
	_ = s.store.UpdateLastAccessed(ctx, sb.ID)
	return ListFileTree(filepath.Join(sb.SandboxPath, "repo"), path)
}

func (s *SandboxService) GetFileContent(ctx context.Context, clusterID uuid.UUID, path string) (*FileContent, error) {
	sb, err := s.RequireActive(ctx, clusterID)
	if err != nil {
		return nil, err
	}
	_ = s.store.UpdateLastAccessed(ctx, sb.ID)
	return ReadFileContent(filepath.Join(sb.SandboxPath, "repo"), path)
}

func (s *SandboxService) DetectDefaultBranch(ctx context.Context, repoURL string) (string, error) {
	return s.git.DetectDefaultBranch(ctx, repoURL)
}

// --- helpers ---

func calculateDiskUsage(dir string) int64 {
	var total int64
	_ = filepath.WalkDir(dir, func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			return nil
		}
		if !d.IsDir() {
			if info, err := d.Info(); err == nil {
				total += info.Size()
			}
		}
		return nil
	})
	return total
}

func deleteDirectoryQuietly(dir, rootPath string) {
	if dir == "" {
		return
	}
	absDir, err := filepath.Abs(dir)
	if err != nil {
		return
	}
	absRoot, err := filepath.Abs(rootPath)
	if err != nil {
		return
	}
	if !strings.HasPrefix(absDir, absRoot) {
		slog.Error("refusing to delete directory outside sandbox root", "dir", dir)
		return
	}
	if err := os.RemoveAll(absDir); err != nil {
		slog.Error("failed to delete directory", "dir", dir, "error", err)
	}
}
