package service

import (
	"context"
	"log/slog"
	"time"

	"brainbook/sandbox-service/internal/config"
	"brainbook/sandbox-service/internal/store"
)

type CleanupScheduler struct {
	store  *store.Store
	config *config.Config
}

func NewCleanupScheduler(st *store.Store, cfg *config.Config) *CleanupScheduler {
	return &CleanupScheduler{store: st, config: cfg}
}

func (c *CleanupScheduler) Start(ctx context.Context) {
	go func() {
		timer := time.NewTimer(timeUntilNext3AM())
		defer timer.Stop()

		for {
			select {
			case <-ctx.Done():
				return
			case <-timer.C:
				c.runCleanup(ctx)
				timer.Reset(timeUntilNext3AM())
			}
		}
	}()

	slog.Info("cleanup scheduler started", "stale_days", c.config.StaleDays)
}

func (c *CleanupScheduler) runCleanup(ctx context.Context) {
	threshold := time.Now().UTC().AddDate(0, 0, -c.config.StaleDays)
	slog.Info("running stale sandbox cleanup", "threshold", threshold)

	stale, err := c.store.FindStale(ctx, threshold)
	if err != nil {
		slog.Error("cleanup: failed to find stale sandboxes", "error", err)
		return
	}

	cleaned := 0
	for _, sb := range stale {
		deleteDirectoryQuietly(sb.SandboxPath, c.config.SandboxRootPath)
		if err := c.store.Delete(ctx, sb.ID); err != nil {
			slog.Error("cleanup: failed to delete sandbox", "id", sb.ID, "error", err)
			continue
		}
		cleaned++
	}

	slog.Info("cleanup complete", "cleaned", cleaned, "total_stale", len(stale))
}

func timeUntilNext3AM() time.Duration {
	now := time.Now().UTC()
	next := time.Date(now.Year(), now.Month(), now.Day(), 3, 0, 0, 0, time.UTC)
	if now.After(next) {
		next = next.Add(24 * time.Hour)
	}
	return time.Until(next)
}
