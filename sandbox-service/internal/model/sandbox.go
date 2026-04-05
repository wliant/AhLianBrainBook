package model

import (
	"time"

	"github.com/google/uuid"
)

const (
	StatusCloning     = "cloning"
	StatusIndexing    = "indexing"
	StatusActive      = "active"
	StatusError       = "error"
	StatusTerminating = "terminating"
)

type Sandbox struct {
	ID             uuid.UUID  `json:"id"`
	ClusterID      uuid.UUID  `json:"cluster_id"`
	BrainID        uuid.UUID  `json:"brain_id"`
	RepoURL        string     `json:"repo_url"`
	CurrentBranch  string     `json:"current_branch"`
	CurrentCommit  *string    `json:"current_commit"`
	SandboxPath    string     `json:"sandbox_path"`
	IsShallow      bool       `json:"is_shallow"`
	Status         string     `json:"status"`
	DiskUsageBytes *int64     `json:"disk_usage_bytes"`
	ErrorMessage   *string    `json:"error_message"`
	LastAccessedAt time.Time  `json:"last_accessed_at"`
	CreatedAt      time.Time  `json:"created_at"`
	UpdatedAt      time.Time  `json:"updated_at"`
}
