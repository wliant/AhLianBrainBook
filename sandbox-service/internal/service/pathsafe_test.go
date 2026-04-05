package service

import (
	"path/filepath"
	"strings"
	"testing"
)

func TestResolveSafePath(t *testing.T) {
	repoDir := t.TempDir()

	tests := []struct {
		name      string
		path      string
		wantErr   bool
		wantEqual string // if non-empty, check resolved equals this
	}{
		{"empty path returns repoDir", "", false, repoDir},
		{"valid relative path", "src/main.go", false, ""},
		{"absolute path /", "/etc/passwd", true, ""},
		{"absolute path backslash", "\\etc\\passwd", true, ""},
		{"traversal dotdot", "../../etc/passwd", true, ""},
		{"traversal in middle", "src/../../etc", true, ""},
		{"dotgit exact", ".git", true, ""},
		{"dotgit slash prefix", ".git/config", true, ""},
		{"dotgit backslash prefix", ".git\\config", true, ""},
		{"valid nested path", "src/main/java/App.java", false, ""},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			resolved, err := ResolveSafePath(repoDir, tt.path)
			if tt.wantErr {
				if err == nil {
					t.Errorf("ResolveSafePath(%q, %q) = nil error, want error", repoDir, tt.path)
				}
				return
			}
			if err != nil {
				t.Errorf("ResolveSafePath(%q, %q) = %v, want nil", repoDir, tt.path, err)
				return
			}
			if tt.wantEqual != "" {
				absWant, _ := filepath.Abs(tt.wantEqual)
				absGot, _ := filepath.Abs(resolved)
				if absGot != absWant {
					t.Errorf("ResolveSafePath(%q, %q) = %q, want %q", repoDir, tt.path, resolved, tt.wantEqual)
				}
			}
			// All resolved paths must be under repoDir
			absRepo, _ := filepath.Abs(repoDir)
			absResolved, _ := filepath.Abs(resolved)
			if !strings.HasPrefix(absResolved, absRepo) {
				t.Errorf("resolved path %q escapes repoDir %q", resolved, repoDir)
			}
		})
	}
}
