package service

import (
	"bufio"
	"bytes"
	"context"
	"fmt"
	"log/slog"
	"net/url"
	"os/exec"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"time"
)

type GitService struct {
	githubPAT string
}

func NewGitService(githubPAT string) *GitService {
	return &GitService{githubPAT: githubPAT}
}

// injectToken rewrites github.com URLs to embed the PAT for private repo access.
// Returns the original URL unchanged for non-GitHub hosts or when no PAT is configured.
func (g *GitService) injectToken(repoURL string) string {
	if g.githubPAT == "" {
		return repoURL
	}
	u, err := url.Parse(repoURL)
	if err != nil {
		return repoURL
	}
	if !strings.EqualFold(u.Hostname(), "github.com") {
		return repoURL
	}
	u.User = url.UserPassword("x-access-token", g.githubPAT)
	return u.String()
}

func (g *GitService) Clone(ctx context.Context, repoURL, branch, targetDir string, shallow bool, timeoutSec int) error {
	timeout := time.Duration(timeoutSec) * time.Second
	ctx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()

	args := []string{"clone", "--branch", branch, "--single-branch", "--no-tags"}
	if shallow {
		args = append(args, "--depth", "1")
	}
	slog.Info("cloning repository", "url", repoURL, "branch", branch, "shallow", shallow, "dir", targetDir)

	args = append(args, g.injectToken(repoURL), targetDir)
	cmd := exec.CommandContext(ctx, "git", args...)
	output, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("git clone failed: %w\n%s", err, string(output))
	}

	// Disable hooks for safety
	cfgCmd := exec.CommandContext(ctx, "git", "-C", targetDir, "config", "core.hooksPath", "/dev/null")
	if out, err := cfgCmd.CombinedOutput(); err != nil {
		slog.Warn("failed to disable git hooks", "error", err, "output", string(out))
	}

	slog.Info("clone complete", "dir", targetDir)
	return nil
}

func (g *GitService) Pull(ctx context.Context, repoDir string) (string, error) {
	cmd := exec.CommandContext(ctx, "git", "-C", repoDir, "pull")
	output, err := cmd.CombinedOutput()
	if err != nil {
		return "", fmt.Errorf("git pull failed: %w\n%s", err, string(output))
	}
	return g.HeadCommit(ctx, repoDir)
}

func (g *GitService) Checkout(ctx context.Context, repoDir, branch string) error {
	cmd := exec.CommandContext(ctx, "git", "-C", repoDir, "checkout", branch)
	output, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("git checkout failed: %w\n%s", err, string(output))
	}
	return nil
}

func (g *GitService) ListBranches(ctx context.Context, repoDir string) ([]string, error) {
	cmd := exec.CommandContext(ctx, "git", "-C", repoDir, "branch", "-a")
	output, err := cmd.Output()
	if err != nil {
		return nil, fmt.Errorf("git branch failed: %w", err)
	}

	seen := make(map[string]bool)
	var branches []string
	scanner := bufio.NewScanner(bytes.NewReader(output))
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		line = strings.TrimPrefix(line, "* ")

		if strings.Contains(line, " -> ") {
			continue // skip HEAD -> origin/main
		}

		name := line
		if strings.HasPrefix(name, "remotes/origin/") {
			name = strings.TrimPrefix(name, "remotes/origin/")
		}

		if name != "" && !seen[name] {
			seen[name] = true
			branches = append(branches, name)
		}
	}

	sort.Strings(branches)
	return branches, nil
}

type CommitInfo struct {
	SHA         string
	Author      string
	AuthorEmail string
	Date        time.Time
	Message     string
}

func (g *GitService) Log(ctx context.Context, repoDir string, limit, offset int) ([]CommitInfo, error) {
	// Use unit separator (0x1f) between fields for reliable parsing
	format := "%H%x1f%an%x1f%ae%x1f%aI%x1f%s"
	args := []string{"-C", repoDir, "log", fmt.Sprintf("--format=%s", format)}
	if offset > 0 {
		args = append(args, fmt.Sprintf("--skip=%d", offset))
	}
	args = append(args, fmt.Sprintf("-n%d", limit))

	cmd := exec.CommandContext(ctx, "git", args...)
	output, err := cmd.Output()
	if err != nil {
		return nil, fmt.Errorf("git log failed: %w", err)
	}

	var commits []CommitInfo
	scanner := bufio.NewScanner(bytes.NewReader(output))
	for scanner.Scan() {
		line := scanner.Text()
		if line == "" {
			continue
		}
		parts := strings.SplitN(line, "\x1f", 5)
		if len(parts) < 5 {
			continue
		}

		date, _ := time.Parse(time.RFC3339, parts[3])
		commits = append(commits, CommitInfo{
			SHA:         parts[0],
			Author:      parts[1],
			AuthorEmail: parts[2],
			Date:        date,
			Message:     parts[4],
		})
	}

	if commits == nil {
		commits = []CommitInfo{}
	}
	return commits, nil
}

type BlameLineInfo struct {
	Line      int
	CommitSHA string
	Author    string
	Date      time.Time
	Content   string
}

func (g *GitService) Blame(ctx context.Context, repoDir, filePath string) ([]BlameLineInfo, error) {
	cmd := exec.CommandContext(ctx, "git", "-C", repoDir, "blame", "--porcelain", filePath)
	output, err := cmd.Output()
	if err != nil {
		return nil, fmt.Errorf("git blame failed: %w\n%s", err, string(output))
	}

	return parseBlamePorcelain(output)
}

// parseBlamePorcelain parses git blame --porcelain output.
// Format: header line, then key-value pairs, then a tab-prefixed content line.
func parseBlamePorcelain(data []byte) ([]BlameLineInfo, error) {
	var result []BlameLineInfo
	lineNum := 0

	var currentSHA string
	commitAuthors := make(map[string]string)
	commitDates := make(map[string]time.Time)

	// Header pattern: <sha> <orig-line> <final-line> [<num-lines>]
	headerRe := regexp.MustCompile(`^([0-9a-f]{40}) \d+ (\d+)`)

	scanner := bufio.NewScanner(bytes.NewReader(data))
	for scanner.Scan() {
		line := scanner.Text()

		if m := headerRe.FindStringSubmatch(line); m != nil {
			currentSHA = m[1]
			n, _ := strconv.Atoi(m[2])
			lineNum = n
			continue
		}

		if strings.HasPrefix(line, "author ") {
			commitAuthors[currentSHA] = strings.TrimPrefix(line, "author ")
			continue
		}

		if strings.HasPrefix(line, "author-time ") {
			ts, err := strconv.ParseInt(strings.TrimPrefix(line, "author-time "), 10, 64)
			if err == nil {
				commitDates[currentSHA] = time.Unix(ts, 0).UTC()
			}
			continue
		}

		if strings.HasPrefix(line, "\t") {
			content := strings.TrimPrefix(line, "\t")
			result = append(result, BlameLineInfo{
				Line:      lineNum,
				CommitSHA: currentSHA,
				Author:    commitAuthors[currentSHA],
				Date:      commitDates[currentSHA],
				Content:   content,
			})
			continue
		}

		// Skip other porcelain metadata lines (author-mail, author-tz, committer, etc.)
	}

	if result == nil {
		result = []BlameLineInfo{}
	}
	return result, nil
}

func (g *GitService) Diff(ctx context.Context, repoDir, fromRef, toRef string) (string, error) {
	cmd := exec.CommandContext(ctx, "git", "-C", repoDir, "diff", fromRef+".."+toRef, "--no-color")
	output, err := cmd.Output()
	if err != nil {
		return "", fmt.Errorf("git diff failed: %w", err)
	}
	return string(output), nil
}

func (g *GitService) HeadCommit(ctx context.Context, repoDir string) (string, error) {
	cmd := exec.CommandContext(ctx, "git", "-C", repoDir, "rev-parse", "HEAD")
	output, err := cmd.Output()
	if err != nil {
		return "", fmt.Errorf("git rev-parse HEAD failed: %w", err)
	}
	return strings.TrimSpace(string(output)), nil
}

func (g *GitService) DetectDefaultBranch(ctx context.Context, repoURL string) (string, error) {
	cmd := exec.CommandContext(ctx, "git", "ls-remote", "--symref", g.injectToken(repoURL), "HEAD")
	output, err := cmd.Output()
	if err != nil {
		slog.Warn("git ls-remote failed, falling back to 'main'", "url", repoURL, "error", err)
		return "main", nil
	}

	// Parse: "ref: refs/heads/<branch>\tHEAD"
	scanner := bufio.NewScanner(bytes.NewReader(output))
	for scanner.Scan() {
		line := scanner.Text()
		if strings.HasPrefix(line, "ref: refs/heads/") {
			// Line format: "ref: refs/heads/main\tHEAD"
			refPart := line
			if tabIdx := strings.Index(line, "\t"); tabIdx >= 0 {
				refPart = line[:tabIdx]
			}
			branch := strings.TrimPrefix(refPart, "ref: refs/heads/")
			if branch != "" {
				return branch, nil
			}
		}
	}

	slog.Warn("could not resolve default branch, falling back to 'main'", "url", repoURL)
	return "main", nil
}
