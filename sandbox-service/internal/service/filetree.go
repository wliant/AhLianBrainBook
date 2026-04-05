package service

import (
	"encoding/base64"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
)

type FileTreeEntry struct {
	Name string
	Path string
	Type string // "directory" or "file"
	Size int64  // 0 for directories
}

func ListFileTree(repoDir, requestedPath string) ([]FileTreeEntry, error) {
	targetDir, err := ResolveSafePath(repoDir, requestedPath)
	if err != nil {
		return nil, err
	}

	info, err := os.Stat(targetDir)
	if err != nil {
		return nil, fmt.Errorf("path not found: %s", requestedPath)
	}
	if !info.IsDir() {
		return nil, fmt.Errorf("path is not a directory: %s", requestedPath)
	}

	entries, err := os.ReadDir(targetDir)
	if err != nil {
		return nil, fmt.Errorf("failed to list directory: %w", err)
	}

	absRepo, _ := filepath.Abs(repoDir)
	var result []FileTreeEntry

	for _, entry := range entries {
		if entry.Name() == ".git" {
			continue
		}

		fullPath := filepath.Join(targetDir, entry.Name())
		relPath, _ := filepath.Rel(absRepo, fullPath)
		relPath = filepath.ToSlash(relPath)

		entryType := "file"
		var size int64
		if entry.IsDir() {
			entryType = "directory"
		} else {
			if info, err := entry.Info(); err == nil {
				size = info.Size()
			}
		}

		result = append(result, FileTreeEntry{
			Name: entry.Name(),
			Path: relPath,
			Type: entryType,
			Size: size,
		})
	}

	sort.Slice(result, func(i, j int) bool {
		if result[i].Type != result[j].Type {
			return result[i].Type == "directory"
		}
		return strings.ToLower(result[i].Name) < strings.ToLower(result[j].Name)
	})

	if result == nil {
		result = []FileTreeEntry{}
	}
	return result, nil
}

const maxFileSize = 1_048_576 // 1 MB

type FileContent struct {
	Path     string
	Content  string
	Language string
	Size     int64
	Encoding string // "utf-8" or "base64"
}

// isBinaryFile checks if data contains null bytes in the first 512 bytes,
// indicating binary content.
func isBinaryFile(data []byte) bool {
	limit := len(data)
	if limit > 512 {
		limit = 512
	}
	for i := 0; i < limit; i++ {
		if data[i] == 0 {
			return true
		}
	}
	return false
}

func ReadFileContent(repoDir, requestedPath string) (*FileContent, error) {
	resolved, err := ResolveSafePath(repoDir, requestedPath)
	if err != nil {
		return nil, err
	}

	info, err := os.Stat(resolved)
	if err != nil {
		return nil, fmt.Errorf("file not found: %s", requestedPath)
	}
	if info.IsDir() {
		return nil, fmt.Errorf("path is a directory, not a file: %s", requestedPath)
	}
	if info.Size() > maxFileSize {
		return nil, fmt.Errorf("file too large to display: %s (%d KB)", requestedPath, info.Size()/1024)
	}

	data, err := os.ReadFile(resolved)
	if err != nil {
		return nil, fmt.Errorf("failed to read file: %w", err)
	}

	language := DetectLanguage(requestedPath)

	// Binary files (including images) are base64-encoded
	if language == "image" || isBinaryFile(data) {
		return &FileContent{
			Path:     requestedPath,
			Content:  base64.StdEncoding.EncodeToString(data),
			Language: language,
			Size:     info.Size(),
			Encoding: "base64",
		}, nil
	}

	return &FileContent{
		Path:     requestedPath,
		Content:  string(data),
		Language: language,
		Size:     info.Size(),
		Encoding: "utf-8",
	}, nil
}
