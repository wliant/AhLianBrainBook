package service

import (
	"testing"
)

func TestValidateRepoURL(t *testing.T) {
	tests := []struct {
		name    string
		url     string
		wantErr bool
	}{
		{"valid github https", "https://github.com/owner/repo.git", false},
		{"valid gitlab https", "https://gitlab.com/owner/repo.git", false},
		{"empty url", "", true},
		{"http not https", "http://github.com/owner/repo.git", true},
		{"ftp scheme", "ftp://github.com/owner/repo.git", true},
		{"ssh scheme", "ssh://git@github.com/owner/repo.git", true},
		{"no scheme", "github.com/owner/repo.git", true},
		{"localhost", "https://localhost/repo", true},
		{"docker internal", "https://host.docker.internal/repo", true},
		{"arbitrary .internal", "https://foo.internal/repo", true},
		{"nested .internal", "https://bar.foo.internal/repo", true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := ValidateRepoURL(tt.url)
			if tt.wantErr && err == nil {
				t.Errorf("ValidateRepoURL(%q) = nil, want error", tt.url)
			}
			if !tt.wantErr && err != nil {
				t.Errorf("ValidateRepoURL(%q) = %v, want nil", tt.url, err)
			}
		})
	}
}
