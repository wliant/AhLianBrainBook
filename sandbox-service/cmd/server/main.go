package main

import (
	"context"
	"fmt"
	"log/slog"
	"net"
	"os"
	"os/signal"
	"syscall"

	"google.golang.org/grpc"
	"google.golang.org/grpc/health"
	healthpb "google.golang.org/grpc/health/grpc_health_v1"
	"google.golang.org/grpc/reflection"

	"github.com/jackc/pgx/v5/pgxpool"

	pb "brainbook/sandbox-service/gen/sandbox/v1"
	"brainbook/sandbox-service/internal/config"
	"brainbook/sandbox-service/internal/server"
	"brainbook/sandbox-service/internal/service"
	"brainbook/sandbox-service/internal/store"
)

func main() {
	slog.SetDefault(slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelInfo})))

	cfg, err := config.Load()
	if err != nil {
		slog.Error("failed to load config", "error", err)
		os.Exit(1)
	}

	slog.Info("starting sandbox service",
		"port", cfg.GRPCPort,
		"root_path", cfg.SandboxRootPath,
		"max_count", cfg.MaxCount,
		"max_concurrent_clones", cfg.MaxConcurrentClones,
	)

	// Run database migrations
	if err := store.RunMigrations(cfg.DatabaseURL); err != nil {
		slog.Error("failed to run migrations", "error", err)
		os.Exit(1)
	}
	slog.Info("database migrations complete")

	// Create connection pool
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	pool, err := pgxpool.New(ctx, cfg.DatabaseURL)
	if err != nil {
		slog.Error("failed to create database pool", "error", err)
		os.Exit(1)
	}
	defer pool.Close()

	if err := pool.Ping(ctx); err != nil {
		slog.Error("failed to ping database", "error", err)
		os.Exit(1)
	}
	slog.Info("database connected")

	// Ensure sandbox root directory exists
	if err := os.MkdirAll(cfg.SandboxRootPath, 0755); err != nil {
		slog.Error("failed to create sandbox root", "path", cfg.SandboxRootPath, "error", err)
		os.Exit(1)
	}

	// Wire services
	st := store.New(pool)
	gitSvc := service.NewGitService(cfg.GitHubPAT)
	sandboxSvc := service.NewSandboxService(ctx, st, gitSvc, cfg)
	cleanup := service.NewCleanupScheduler(st, cfg)

	// Start cleanup scheduler
	cleanup.Start(ctx)

	// Start gRPC server
	lis, err := net.Listen("tcp", fmt.Sprintf(":%d", cfg.GRPCPort))
	if err != nil {
		slog.Error("failed to listen", "port", cfg.GRPCPort, "error", err)
		os.Exit(1)
	}

	grpcServer := grpc.NewServer()
	pb.RegisterSandboxServiceServer(grpcServer, server.NewSandboxServer(sandboxSvc, gitSvc))

	// Health check for Docker healthcheck via grpc_health_probe
	healthServer := health.NewServer()
	healthpb.RegisterHealthServer(grpcServer, healthServer)
	healthServer.SetServingStatus("", healthpb.HealthCheckResponse_SERVING)

	// Reflection for debugging with grpcurl
	reflection.Register(grpcServer)

	// Graceful shutdown
	go func() {
		sigCh := make(chan os.Signal, 1)
		signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)
		sig := <-sigCh
		slog.Info("received shutdown signal", "signal", sig)
		cancel()
		grpcServer.GracefulStop()
	}()

	slog.Info("gRPC server listening", "port", cfg.GRPCPort)
	if err := grpcServer.Serve(lis); err != nil {
		slog.Error("gRPC server failed", "error", err)
		os.Exit(1)
	}
}
