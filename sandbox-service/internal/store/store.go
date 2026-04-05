package store

import (
	"context"
	"embed"
	"fmt"
	"time"

	"github.com/golang-migrate/migrate/v4"
	_ "github.com/golang-migrate/migrate/v4/database/postgres"
	"github.com/golang-migrate/migrate/v4/source/iofs"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"brainbook/sandbox-service/internal/model"
)

//go:embed migrations/*.sql
var migrationsFS embed.FS

type Store struct {
	pool *pgxpool.Pool
}

func New(pool *pgxpool.Pool) *Store {
	return &Store{pool: pool}
}

func RunMigrations(databaseURL string) error {
	d, err := iofs.New(migrationsFS, "migrations")
	if err != nil {
		return fmt.Errorf("create migration source: %w", err)
	}
	m, err := migrate.NewWithSourceInstance("iofs", d, databaseURL)
	if err != nil {
		return fmt.Errorf("create migrator: %w", err)
	}
	if err := m.Up(); err != nil && err != migrate.ErrNoChange {
		return fmt.Errorf("run migrations: %w", err)
	}
	return nil
}

func (s *Store) GetByClusterID(ctx context.Context, clusterID uuid.UUID) (*model.Sandbox, error) {
	row := s.pool.QueryRow(ctx,
		`SELECT id, cluster_id, brain_id, repo_url, current_branch, current_commit,
		        sandbox_path, is_shallow, status, disk_usage_bytes, error_message,
		        last_accessed_at, created_at, updated_at
		 FROM sandboxes WHERE cluster_id = $1`, clusterID)
	return scanSandbox(row)
}

func (s *Store) GetByID(ctx context.Context, id uuid.UUID) (*model.Sandbox, error) {
	row := s.pool.QueryRow(ctx,
		`SELECT id, cluster_id, brain_id, repo_url, current_branch, current_commit,
		        sandbox_path, is_shallow, status, disk_usage_bytes, error_message,
		        last_accessed_at, created_at, updated_at
		 FROM sandboxes WHERE id = $1`, id)
	return scanSandbox(row)
}

func (s *Store) ListByBrainID(ctx context.Context, brainID uuid.UUID) ([]*model.Sandbox, error) {
	rows, err := s.pool.Query(ctx,
		`SELECT id, cluster_id, brain_id, repo_url, current_branch, current_commit,
		        sandbox_path, is_shallow, status, disk_usage_bytes, error_message,
		        last_accessed_at, created_at, updated_at
		 FROM sandboxes WHERE brain_id = $1`, brainID)
	if err != nil {
		return nil, err
	}
	return scanSandboxes(rows)
}

func (s *Store) ListActive(ctx context.Context) ([]*model.Sandbox, error) {
	rows, err := s.pool.Query(ctx,
		`SELECT id, cluster_id, brain_id, repo_url, current_branch, current_commit,
		        sandbox_path, is_shallow, status, disk_usage_bytes, error_message,
		        last_accessed_at, created_at, updated_at
		 FROM sandboxes WHERE status = 'active'`)
	if err != nil {
		return nil, err
	}
	return scanSandboxes(rows)
}

func (s *Store) CountByStatuses(ctx context.Context, statuses []string) (int64, error) {
	var count int64
	err := s.pool.QueryRow(ctx,
		`SELECT COUNT(*) FROM sandboxes WHERE status = ANY($1::text[])`, statuses).Scan(&count)
	return count, err
}

func (s *Store) SumDiskUsageActive(ctx context.Context) (int64, error) {
	var sum int64
	err := s.pool.QueryRow(ctx,
		`SELECT COALESCE(SUM(disk_usage_bytes), 0)::bigint FROM sandboxes WHERE status = 'active' AND disk_usage_bytes IS NOT NULL`).Scan(&sum)
	return sum, err
}

func (s *Store) FindStale(ctx context.Context, threshold time.Time) ([]*model.Sandbox, error) {
	rows, err := s.pool.Query(ctx,
		`SELECT id, cluster_id, brain_id, repo_url, current_branch, current_commit,
		        sandbox_path, is_shallow, status, disk_usage_bytes, error_message,
		        last_accessed_at, created_at, updated_at
		 FROM sandboxes WHERE status = 'active' AND last_accessed_at < $1`, threshold)
	if err != nil {
		return nil, err
	}
	return scanSandboxes(rows)
}

func (s *Store) Insert(ctx context.Context, clusterID, brainID uuid.UUID, repoURL, branch, sandboxPath string, isShallow bool) (*model.Sandbox, error) {
	row := s.pool.QueryRow(ctx,
		`INSERT INTO sandboxes (cluster_id, brain_id, repo_url, current_branch, sandbox_path, is_shallow, status)
		 VALUES ($1, $2, $3, $4, $5, $6, 'cloning')
		 RETURNING id, cluster_id, brain_id, repo_url, current_branch, current_commit,
		           sandbox_path, is_shallow, status, disk_usage_bytes, error_message,
		           last_accessed_at, created_at, updated_at`,
		clusterID, brainID, repoURL, branch, sandboxPath, isShallow)
	return scanSandbox(row)
}

func (s *Store) UpdateStatus(ctx context.Context, id uuid.UUID, status string) error {
	_, err := s.pool.Exec(ctx,
		`UPDATE sandboxes SET status = $2, updated_at = NOW() WHERE id = $1`, id, status)
	return err
}

func (s *Store) UpdateStatusWithError(ctx context.Context, id uuid.UUID, status, errMsg string) error {
	_, err := s.pool.Exec(ctx,
		`UPDATE sandboxes SET status = $2, error_message = $3, updated_at = NOW() WHERE id = $1`,
		id, status, errMsg)
	return err
}

func (s *Store) UpdateAfterClone(ctx context.Context, id uuid.UUID, commit string, diskUsage int64) error {
	_, err := s.pool.Exec(ctx,
		`UPDATE sandboxes SET status = 'active', current_commit = $2, disk_usage_bytes = $3, updated_at = NOW() WHERE id = $1`,
		id, commit, diskUsage)
	return err
}

func (s *Store) UpdateAfterPull(ctx context.Context, id uuid.UUID, commit string) error {
	_, err := s.pool.Exec(ctx,
		`UPDATE sandboxes SET current_commit = $2, last_accessed_at = NOW(), updated_at = NOW() WHERE id = $1`,
		id, commit)
	return err
}

func (s *Store) UpdateAfterCheckout(ctx context.Context, id uuid.UUID, branch, commit string) error {
	_, err := s.pool.Exec(ctx,
		`UPDATE sandboxes SET current_branch = $2, current_commit = $3, last_accessed_at = NOW(), updated_at = NOW() WHERE id = $1`,
		id, branch, commit)
	return err
}

func (s *Store) UpdateLastAccessed(ctx context.Context, id uuid.UUID) error {
	_, err := s.pool.Exec(ctx,
		`UPDATE sandboxes SET last_accessed_at = NOW(), updated_at = NOW() WHERE id = $1`, id)
	return err
}

func (s *Store) ClearErrorAndSetCloning(ctx context.Context, id uuid.UUID) error {
	_, err := s.pool.Exec(ctx,
		`UPDATE sandboxes SET status = 'cloning', error_message = NULL, updated_at = NOW() WHERE id = $1`, id)
	return err
}

func (s *Store) UpdateSandboxPath(ctx context.Context, id uuid.UUID, sandboxPath string) error {
	_, err := s.pool.Exec(ctx,
		`UPDATE sandboxes SET sandbox_path = $2, updated_at = NOW() WHERE id = $1`, id, sandboxPath)
	return err
}

func (s *Store) Delete(ctx context.Context, id uuid.UUID) error {
	_, err := s.pool.Exec(ctx,
		`DELETE FROM sandboxes WHERE id = $1`, id)
	return err
}

func (s *Store) DeleteByBrainID(ctx context.Context, brainID uuid.UUID) (int64, error) {
	tag, err := s.pool.Exec(ctx,
		`DELETE FROM sandboxes WHERE brain_id = $1`, brainID)
	if err != nil {
		return 0, err
	}
	return tag.RowsAffected(), nil
}

// --- scan helpers ---

func scanSandbox(row pgx.Row) (*model.Sandbox, error) {
	sb := &model.Sandbox{}
	err := row.Scan(
		&sb.ID, &sb.ClusterID, &sb.BrainID, &sb.RepoURL, &sb.CurrentBranch, &sb.CurrentCommit,
		&sb.SandboxPath, &sb.IsShallow, &sb.Status, &sb.DiskUsageBytes, &sb.ErrorMessage,
		&sb.LastAccessedAt, &sb.CreatedAt, &sb.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	return sb, nil
}

func scanSandboxes(rows pgx.Rows) ([]*model.Sandbox, error) {
	defer rows.Close()
	var result []*model.Sandbox
	for rows.Next() {
		sb := &model.Sandbox{}
		err := rows.Scan(
			&sb.ID, &sb.ClusterID, &sb.BrainID, &sb.RepoURL, &sb.CurrentBranch, &sb.CurrentCommit,
			&sb.SandboxPath, &sb.IsShallow, &sb.Status, &sb.DiskUsageBytes, &sb.ErrorMessage,
			&sb.LastAccessedAt, &sb.CreatedAt, &sb.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}
		result = append(result, sb)
	}
	if result == nil {
		result = []*model.Sandbox{}
	}
	return result, rows.Err()
}
