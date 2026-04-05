package service

import "testing"

func TestDetectLanguage(t *testing.T) {
	tests := []struct {
		path string
		want string
	}{
		{"main.java", "java"},
		{"script.py", "python"},
		{"app.js", "javascript"},
		{"component.tsx", "typescript"},
		{"config.yml", "yaml"},
		{"config.yaml", "yaml"},
		{"style.css", "css"},
		{"style.scss", "css"},
		{"main.go", "go"},
		{"lib.rs", "rust"},
		{"query.sql", "sql"},
		{"doc.md", "markdown"},
		{"build.gradle", "groovy"},
		{"config.toml", "toml"},
		{"index.html", "html"},
		{"page.htm", "html"},
		{"run.sh", "bash"},
		{"App.kt", "kotlin"},

		// path with directories
		{"src/main/java/App.java", "java"},
		{"web/src/components/Button.tsx", "typescript"},

		// case insensitive
		{"FILE.JAVA", "java"},
		{"Script.PY", "python"},

		// no extension
		{"Makefile", ""},
		{"Dockerfile", ""},

		// unknown extension
		{"file.xyz", ""},
		{"data.csv", ""},

		// dot only
		{".gitignore", ""},
	}

	for _, tt := range tests {
		t.Run(tt.path, func(t *testing.T) {
			got := DetectLanguage(tt.path)
			if got != tt.want {
				t.Errorf("DetectLanguage(%q) = %q, want %q", tt.path, got, tt.want)
			}
		})
	}
}
