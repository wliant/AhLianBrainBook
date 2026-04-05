package service

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestListFileTree(t *testing.T) {
	t.Run("dirs first then files alphabetical", func(t *testing.T) {
		dir := t.TempDir()
		// Create files and dirs
		os.MkdirAll(filepath.Join(dir, "src"), 0755)
		os.MkdirAll(filepath.Join(dir, "docs"), 0755)
		os.WriteFile(filepath.Join(dir, "README.md"), []byte("hello"), 0644)
		os.WriteFile(filepath.Join(dir, "app.go"), []byte("package main"), 0644)

		entries, err := ListFileTree(dir, "")
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if len(entries) != 4 {
			t.Fatalf("expected 4 entries, got %d", len(entries))
		}
		// Directories first, alphabetical
		if entries[0].Name != "docs" || entries[0].Type != "directory" {
			t.Errorf("entries[0] = %+v, want docs directory", entries[0])
		}
		if entries[1].Name != "src" || entries[1].Type != "directory" {
			t.Errorf("entries[1] = %+v, want src directory", entries[1])
		}
		// Files next, alphabetical (case-insensitive)
		if entries[2].Name != "app.go" || entries[2].Type != "file" {
			t.Errorf("entries[2] = %+v, want app.go file", entries[2])
		}
		if entries[3].Name != "README.md" || entries[3].Type != "file" {
			t.Errorf("entries[3] = %+v, want README.md file", entries[3])
		}
	})

	t.Run("filters .git directory", func(t *testing.T) {
		dir := t.TempDir()
		os.MkdirAll(filepath.Join(dir, ".git"), 0755)
		os.WriteFile(filepath.Join(dir, "file.txt"), []byte("content"), 0644)

		entries, err := ListFileTree(dir, "")
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if len(entries) != 1 {
			t.Fatalf("expected 1 entry (.git filtered), got %d", len(entries))
		}
		if entries[0].Name != "file.txt" {
			t.Errorf("expected file.txt, got %s", entries[0].Name)
		}
	})

	t.Run("empty directory", func(t *testing.T) {
		dir := t.TempDir()
		entries, err := ListFileTree(dir, "")
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if len(entries) != 0 {
			t.Errorf("expected empty slice, got %d entries", len(entries))
		}
	})

	t.Run("subdirectory listing", func(t *testing.T) {
		dir := t.TempDir()
		os.MkdirAll(filepath.Join(dir, "src"), 0755)
		os.WriteFile(filepath.Join(dir, "src", "main.go"), []byte("package main"), 0644)

		entries, err := ListFileTree(dir, "src")
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if len(entries) != 1 {
			t.Fatalf("expected 1 entry, got %d", len(entries))
		}
		if entries[0].Name != "main.go" {
			t.Errorf("expected main.go, got %s", entries[0].Name)
		}
		// Path should be relative to repo root
		if entries[0].Path != "src/main.go" {
			t.Errorf("expected path src/main.go, got %s", entries[0].Path)
		}
	})

	t.Run("path traversal rejected", func(t *testing.T) {
		dir := t.TempDir()
		_, err := ListFileTree(dir, "../../etc")
		if err == nil {
			t.Error("expected error for path traversal, got nil")
		}
	})
}

func TestReadFileContent(t *testing.T) {
	t.Run("read small file", func(t *testing.T) {
		dir := t.TempDir()
		content := "Hello World!"
		os.WriteFile(filepath.Join(dir, "hello.py"), []byte(content), 0644)

		fc, err := ReadFileContent(dir, "hello.py")
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if fc.Content != content {
			t.Errorf("content = %q, want %q", fc.Content, content)
		}
		if fc.Language != "python" {
			t.Errorf("language = %q, want python", fc.Language)
		}
		if fc.Size != int64(len(content)) {
			t.Errorf("size = %d, want %d", fc.Size, len(content))
		}
		if fc.Path != "hello.py" {
			t.Errorf("path = %q, want hello.py", fc.Path)
		}
	})

	t.Run("file too large", func(t *testing.T) {
		dir := t.TempDir()
		// Create a file larger than 1MB
		large := make([]byte, 1_048_577)
		os.WriteFile(filepath.Join(dir, "big.txt"), large, 0644)

		_, err := ReadFileContent(dir, "big.txt")
		if err == nil {
			t.Error("expected error for large file, got nil")
		}
		if !strings.Contains(err.Error(), "file too large") {
			t.Errorf("error = %q, want 'file too large'", err.Error())
		}
	})

	t.Run("path is directory", func(t *testing.T) {
		dir := t.TempDir()
		os.MkdirAll(filepath.Join(dir, "subdir"), 0755)

		_, err := ReadFileContent(dir, "subdir")
		if err == nil {
			t.Error("expected error for directory, got nil")
		}
	})

	t.Run("file not found", func(t *testing.T) {
		dir := t.TempDir()
		_, err := ReadFileContent(dir, "nonexistent.txt")
		if err == nil {
			t.Error("expected error for missing file, got nil")
		}
	})

	t.Run("path traversal rejected", func(t *testing.T) {
		dir := t.TempDir()
		_, err := ReadFileContent(dir, "../../etc/passwd")
		if err == nil {
			t.Error("expected error for path traversal, got nil")
		}
	})
}
