package service

import (
	"path/filepath"
	"strings"
)

var extToLang = map[string]string{
	"java":   "java",
	"py":     "python",
	"js":     "javascript",
	"jsx":    "javascript",
	"ts":     "typescript",
	"tsx":    "typescript",
	"go":     "go",
	"rs":     "rust",
	"cpp":    "cpp",
	"cc":     "cpp",
	"cxx":    "cpp",
	"c":      "c",
	"h":      "c",
	"hpp":    "cpp",
	"cs":     "csharp",
	"html":   "html",
	"htm":    "html",
	"css":    "css",
	"scss":   "css",
	"json":   "json",
	"md":     "markdown",
	"sql":    "sql",
	"xml":    "xml",
	"yaml":   "yaml",
	"yml":    "yaml",
	"sh":     "bash",
	"bash":   "bash",
	"kt":     "kotlin",
	"gradle": "groovy",
	"toml":   "toml",
}

func DetectLanguage(path string) string {
	ext := filepath.Ext(path)
	if ext == "" {
		return ""
	}
	ext = strings.TrimPrefix(ext, ".")
	ext = strings.ToLower(ext)
	if lang, ok := extToLang[ext]; ok {
		return lang
	}
	return ""
}
