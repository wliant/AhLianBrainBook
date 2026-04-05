package config

import (
	"os"
	"strconv"
)

type Config struct {
	DatabaseURL         string
	GRPCPort            int
	SandboxRootPath     string
	MaxRepoSizeMB       int
	MaxTotalDiskMB      int
	CloneTimeoutSec     int
	MaxConcurrentClones int
	MaxCount            int
	StaleDays           int
	GitHubPAT           string
}

func (c *Config) MaxRepoSizeBytes() int64 {
	return int64(c.MaxRepoSizeMB) * 1024 * 1024
}

func (c *Config) MaxTotalDiskBytes() int64 {
	return int64(c.MaxTotalDiskMB) * 1024 * 1024
}

func Load() (*Config, error) {
	return &Config{
		DatabaseURL:         envStr("DATABASE_URL", ""),
		GRPCPort:            envInt("GRPC_PORT", 50051),
		SandboxRootPath:     envStr("SANDBOX_ROOT_PATH", "/data/sandboxes"),
		MaxRepoSizeMB:       envInt("SANDBOX_MAX_REPO_SIZE_MB", 1000),
		MaxTotalDiskMB:      envInt("SANDBOX_MAX_TOTAL_DISK_MB", 5120),
		CloneTimeoutSec:     envInt("SANDBOX_CLONE_TIMEOUT_SEC", 300),
		MaxConcurrentClones: envInt("SANDBOX_MAX_CONCURRENT_CLONES", 2),
		MaxCount:            envInt("SANDBOX_MAX_COUNT", 10),
		StaleDays:           envInt("SANDBOX_STALE_DAYS", 30),
		GitHubPAT:           envStr("GITHUB_PAT", ""),
	}, nil
}

func envStr(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func envInt(key string, fallback int) int {
	if v := os.Getenv(key); v != "" {
		if n, err := strconv.Atoi(v); err == nil {
			return n
		}
	}
	return fallback
}
