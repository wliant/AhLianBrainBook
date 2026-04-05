package service

import (
	"fmt"
	"path/filepath"
	"strings"
)

func ResolveSafePath(repoDir, requestedPath string) (string, error) {
	if requestedPath == "" {
		return repoDir, nil
	}

	if strings.HasPrefix(requestedPath, "/") || strings.HasPrefix(requestedPath, "\\") {
		return "", fmt.Errorf("absolute paths not allowed: %s", requestedPath)
	}

	if strings.Contains(requestedPath, "..") {
		return "", fmt.Errorf("path traversal not allowed: %s", requestedPath)
	}

	if requestedPath == ".git" || strings.HasPrefix(requestedPath, ".git/") || strings.HasPrefix(requestedPath, ".git\\") {
		return "", fmt.Errorf("access to .git directory not allowed")
	}

	resolved := filepath.Join(repoDir, requestedPath)
	resolved, err := filepath.Abs(resolved)
	if err != nil {
		return "", fmt.Errorf("failed to resolve path: %w", err)
	}

	absRepo, err := filepath.Abs(repoDir)
	if err != nil {
		return "", fmt.Errorf("failed to resolve repo dir: %w", err)
	}

	if !strings.HasPrefix(resolved, absRepo) {
		return "", fmt.Errorf("path traversal attempt: %s", requestedPath)
	}

	return resolved, nil
}
