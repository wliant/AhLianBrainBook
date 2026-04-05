package service

import (
	"testing"
	"time"
)

func TestInjectToken(t *testing.T) {
	tests := []struct {
		name   string
		pat    string
		url    string
		want   string
	}{
		{
			"no PAT configured",
			"",
			"https://github.com/owner/repo.git",
			"https://github.com/owner/repo.git",
		},
		{
			"github URL with PAT",
			"ghp_test123",
			"https://github.com/owner/repo.git",
			"https://x-access-token:ghp_test123@github.com/owner/repo.git",
		},
		{
			"non-github URL with PAT",
			"ghp_test123",
			"https://gitlab.com/owner/repo.git",
			"https://gitlab.com/owner/repo.git",
		},
		{
			"github URL case insensitive",
			"ghp_test123",
			"https://GitHub.com/owner/repo.git",
			"https://x-access-token:ghp_test123@GitHub.com/owner/repo.git",
		},
		{
			"invalid URL returns unchanged",
			"ghp_test123",
			"://invalid",
			"://invalid",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			g := NewGitService(tt.pat)
			got := g.injectToken(tt.url)
			if got != tt.want {
				t.Errorf("injectToken(%q) = %q, want %q", tt.url, got, tt.want)
			}
		})
	}
}

func TestParseBlamePorcelain(t *testing.T) {
	t.Run("empty input", func(t *testing.T) {
		result, err := parseBlamePorcelain([]byte{})
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if len(result) != 0 {
			t.Errorf("expected empty slice, got %d entries", len(result))
		}
	})

	t.Run("two lines", func(t *testing.T) {
		// Simulated git blame --porcelain output
		input := `abc123456789012345678901234567890123abcd 1 1 2
author Alice
author-mail <alice@example.com>
author-time 1700000000
author-tz +0000
committer Alice
committer-mail <alice@example.com>
committer-time 1700000000
committer-tz +0000
summary initial commit
filename README.md
	Hello World!
abc123456789012345678901234567890123abcd 2 2
	Second line
`
		result, err := parseBlamePorcelain([]byte(input))
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if len(result) != 2 {
			t.Fatalf("expected 2 lines, got %d", len(result))
		}

		if result[0].Line != 1 {
			t.Errorf("line[0].Line = %d, want 1", result[0].Line)
		}
		if result[0].CommitSHA != "abc123456789012345678901234567890123abcd" {
			t.Errorf("line[0].CommitSHA = %q, want abc...", result[0].CommitSHA)
		}
		if result[0].Author != "Alice" {
			t.Errorf("line[0].Author = %q, want Alice", result[0].Author)
		}
		if result[0].Content != "Hello World!" {
			t.Errorf("line[0].Content = %q, want 'Hello World!'", result[0].Content)
		}
		expectedDate := time.Unix(1700000000, 0).UTC()
		if !result[0].Date.Equal(expectedDate) {
			t.Errorf("line[0].Date = %v, want %v", result[0].Date, expectedDate)
		}

		if result[1].Line != 2 {
			t.Errorf("line[1].Line = %d, want 2", result[1].Line)
		}
		if result[1].Content != "Second line" {
			t.Errorf("line[1].Content = %q, want 'Second line'", result[1].Content)
		}
		// Second line reuses the same commit — author should be cached
		if result[1].Author != "Alice" {
			t.Errorf("line[1].Author = %q, want Alice (cached from first commit)", result[1].Author)
		}
	})
}
