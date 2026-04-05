package server

import (
	"context"
	"log/slog"
	"strings"

	"github.com/google/uuid"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/types/known/timestamppb"

	pb "brainbook/sandbox-service/gen/sandbox/v1"
	"brainbook/sandbox-service/internal/model"
	"brainbook/sandbox-service/internal/service"
)

type SandboxServer struct {
	pb.UnimplementedSandboxServiceServer
	svc *service.SandboxService
	git *service.GitService
}

func NewSandboxServer(svc *service.SandboxService, git *service.GitService) *SandboxServer {
	return &SandboxServer{svc: svc, git: git}
}

// --- Lifecycle ---

func (s *SandboxServer) Provision(ctx context.Context, req *pb.ProvisionRequest) (*pb.SandboxInfo, error) {
	clusterID, err := uuid.Parse(req.ClusterId)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid cluster_id: %s", req.ClusterId)
	}
	brainID, err := uuid.Parse(req.BrainId)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid brain_id: %s", req.BrainId)
	}

	sb, err := s.svc.Provision(ctx, clusterID, brainID, req.RepoUrl, req.Branch, req.Shallow)
	if err != nil {
		return nil, mapError(err)
	}
	return toProto(sb), nil
}

func (s *SandboxServer) GetStatus(ctx context.Context, req *pb.GetStatusRequest) (*pb.SandboxInfo, error) {
	clusterID, err := uuid.Parse(req.ClusterId)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid cluster_id")
	}
	sb, err := s.svc.GetByClusterID(ctx, clusterID)
	if err != nil {
		return nil, mapError(err)
	}
	return toProto(sb), nil
}

func (s *SandboxServer) Terminate(ctx context.Context, req *pb.TerminateRequest) (*pb.TerminateResponse, error) {
	clusterID, err := uuid.Parse(req.ClusterId)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid cluster_id")
	}
	if err := s.svc.Terminate(ctx, clusterID); err != nil {
		return nil, mapError(err)
	}
	return &pb.TerminateResponse{}, nil
}

func (s *SandboxServer) TerminateByBrain(ctx context.Context, req *pb.TerminateByBrainRequest) (*pb.TerminateByBrainResponse, error) {
	brainID, err := uuid.Parse(req.BrainId)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid brain_id")
	}
	count, err := s.svc.TerminateByBrain(ctx, brainID)
	if err != nil {
		return nil, mapError(err)
	}
	return &pb.TerminateByBrainResponse{TerminatedCount: count}, nil
}

func (s *SandboxServer) Retry(ctx context.Context, req *pb.RetryRequest) (*pb.SandboxInfo, error) {
	clusterID, err := uuid.Parse(req.ClusterId)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid cluster_id")
	}
	sb, err := s.svc.Retry(ctx, clusterID)
	if err != nil {
		return nil, mapError(err)
	}
	return toProto(sb), nil
}

func (s *SandboxServer) ListActive(ctx context.Context, _ *pb.ListActiveRequest) (*pb.ListActiveResponse, error) {
	sandboxes, err := s.svc.ListActive(ctx)
	if err != nil {
		return nil, mapError(err)
	}
	resp := &pb.ListActiveResponse{}
	for _, sb := range sandboxes {
		resp.Sandboxes = append(resp.Sandboxes, toProto(sb))
	}
	return resp, nil
}

// --- Git Operations ---

func (s *SandboxServer) Pull(ctx context.Context, req *pb.PullRequest) (*pb.PullResponse, error) {
	clusterID, err := uuid.Parse(req.ClusterId)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid cluster_id")
	}
	newCommit, err := s.svc.Pull(ctx, clusterID)
	if err != nil {
		return nil, mapError(err)
	}
	return &pb.PullResponse{NewCommit: newCommit}, nil
}

func (s *SandboxServer) Checkout(ctx context.Context, req *pb.CheckoutRequest) (*pb.SandboxInfo, error) {
	clusterID, err := uuid.Parse(req.ClusterId)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid cluster_id")
	}
	sb, err := s.svc.Checkout(ctx, clusterID, req.Branch)
	if err != nil {
		return nil, mapError(err)
	}
	return toProto(sb), nil
}

func (s *SandboxServer) ListBranches(ctx context.Context, req *pb.ListBranchesRequest) (*pb.ListBranchesResponse, error) {
	clusterID, err := uuid.Parse(req.ClusterId)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid cluster_id")
	}
	branches, err := s.svc.ListBranches(ctx, clusterID)
	if err != nil {
		return nil, mapError(err)
	}
	return &pb.ListBranchesResponse{Branches: branches}, nil
}

func (s *SandboxServer) GetLog(ctx context.Context, req *pb.GetLogRequest) (*pb.GetLogResponse, error) {
	clusterID, err := uuid.Parse(req.ClusterId)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid cluster_id")
	}
	limit := int(req.Limit)
	if limit <= 0 {
		limit = 50
	}
	if limit > 200 {
		limit = 200
	}
	commits, err := s.svc.GetLog(ctx, clusterID, limit, int(req.Offset))
	if err != nil {
		return nil, mapError(err)
	}
	resp := &pb.GetLogResponse{}
	for _, c := range commits {
		resp.Commits = append(resp.Commits, &pb.GitCommit{
			Sha:         c.SHA,
			Author:      c.Author,
			AuthorEmail: c.AuthorEmail,
			Date:        timestamppb.New(c.Date),
			Message:     c.Message,
		})
	}
	return resp, nil
}

func (s *SandboxServer) GetBlame(ctx context.Context, req *pb.GetBlameRequest) (*pb.GetBlameResponse, error) {
	clusterID, err := uuid.Parse(req.ClusterId)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid cluster_id")
	}
	lines, err := s.svc.GetBlame(ctx, clusterID, req.Path)
	if err != nil {
		return nil, mapError(err)
	}
	resp := &pb.GetBlameResponse{}
	for _, l := range lines {
		resp.Lines = append(resp.Lines, &pb.BlameLine{
			Line:      int32(l.Line),
			CommitSha: l.CommitSHA,
			Author:    l.Author,
			Date:      timestamppb.New(l.Date),
			Content:   l.Content,
		})
	}
	return resp, nil
}

func (s *SandboxServer) GetDiff(ctx context.Context, req *pb.GetDiffRequest) (*pb.GetDiffResponse, error) {
	clusterID, err := uuid.Parse(req.ClusterId)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid cluster_id")
	}
	diff, err := s.svc.GetDiff(ctx, clusterID, req.FromRef, req.ToRef)
	if err != nil {
		return nil, mapError(err)
	}
	return &pb.GetDiffResponse{UnifiedDiff: diff}, nil
}

func (s *SandboxServer) DetectDefaultBranch(ctx context.Context, req *pb.DetectDefaultBranchRequest) (*pb.DetectDefaultBranchResponse, error) {
	branch, err := s.svc.DetectDefaultBranch(ctx, req.RepoUrl)
	if err != nil {
		return nil, mapError(err)
	}
	return &pb.DetectDefaultBranchResponse{Branch: branch}, nil
}

// --- File Operations ---

func (s *SandboxServer) GetFileTree(ctx context.Context, req *pb.GetFileTreeRequest) (*pb.GetFileTreeResponse, error) {
	clusterID, err := uuid.Parse(req.ClusterId)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid cluster_id")
	}
	entries, err := s.svc.GetFileTree(ctx, clusterID, req.Path)
	if err != nil {
		return nil, mapError(err)
	}
	resp := &pb.GetFileTreeResponse{}
	for _, e := range entries {
		resp.Entries = append(resp.Entries, &pb.FileTreeEntry{
			Name: e.Name,
			Path: e.Path,
			Type: e.Type,
			Size: e.Size,
		})
	}
	return resp, nil
}

func (s *SandboxServer) GetFileContent(ctx context.Context, req *pb.GetFileContentRequest) (*pb.GetFileContentResponse, error) {
	clusterID, err := uuid.Parse(req.ClusterId)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid cluster_id")
	}
	fc, err := s.svc.GetFileContent(ctx, clusterID, req.Path)
	if err != nil {
		return nil, mapError(err)
	}
	return &pb.GetFileContentResponse{
		Path:     fc.Path,
		Content:  fc.Content,
		Language: fc.Language,
		Size:     fc.Size,
	}, nil
}

// --- helpers ---

func toProto(sb *model.Sandbox) *pb.SandboxInfo {
	info := &pb.SandboxInfo{
		Id:             sb.ID.String(),
		ClusterId:      sb.ClusterID.String(),
		BrainId:        sb.BrainID.String(),
		RepoUrl:        sb.RepoURL,
		CurrentBranch:  sb.CurrentBranch,
		IsShallow:      sb.IsShallow,
		Status:         sb.Status,
		LastAccessedAt: timestamppb.New(sb.LastAccessedAt),
		CreatedAt:      timestamppb.New(sb.CreatedAt),
		UpdatedAt:      timestamppb.New(sb.UpdatedAt),
	}
	if sb.CurrentCommit != nil {
		info.CurrentCommit = *sb.CurrentCommit
	}
	if sb.DiskUsageBytes != nil {
		info.DiskUsageBytes = *sb.DiskUsageBytes
	}
	if sb.ErrorMessage != nil {
		info.ErrorMessage = *sb.ErrorMessage
	}
	return info
}

func mapError(err error) error {
	if err == nil {
		return nil
	}
	msg := err.Error()

	// Not found
	if containsAny(msg, "no sandbox for cluster", "file not found", "path not found") {
		return status.Errorf(codes.NotFound, msg)
	}
	// Already exists
	if containsAny(msg, "sandbox already exists") {
		return status.Errorf(codes.AlreadyExists, msg)
	}
	// Precondition failed (wrong status)
	if containsAny(msg, "sandbox is not active", "can only retry") {
		return status.Errorf(codes.FailedPrecondition, msg)
	}
	// Resource exhausted (quotas)
	if containsAny(msg, "maximum sandbox count", "disk quota exceeded", "Too many concurrent", "Repository too large") {
		return status.Errorf(codes.ResourceExhausted, msg)
	}
	// Invalid argument
	if containsAny(msg, "only HTTPS", "invalid repository URL", "repository URL is required",
		"missing host", "cannot resolve", "file too large", "invalid cluster_id", "invalid brain_id") {
		return status.Errorf(codes.InvalidArgument, msg)
	}
	// Permission denied (path traversal, SSRF)
	if containsAny(msg, "absolute paths not allowed", "path traversal", ".git directory not allowed",
		"local address", "private/local address") {
		return status.Errorf(codes.PermissionDenied, msg)
	}

	slog.Error("unhandled error", "error", err)
	return status.Errorf(codes.Internal, msg)
}

func containsAny(msg string, substrs ...string) bool {
	for _, s := range substrs {
		if strings.Contains(msg, s) {
			return true
		}
	}
	return false
}
