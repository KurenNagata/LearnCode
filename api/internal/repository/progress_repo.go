package repository

import (
	"context"
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"learning_language/api/internal/domain"
)

type ProgressRepo struct {
	db *pgxpool.Pool
}

func NewProgressRepo(db *pgxpool.Pool) *ProgressRepo {
	return &ProgressRepo{db: db}
}

func (r *ProgressRepo) GetProgress(ctx context.Context, userID string, problemID int64) (domain.Progress, error) {
	var p domain.Progress
	err := r.db.QueryRow(ctx,
		`SELECT user_id, problem_id, status, cleared_at FROM progress WHERE user_id=$1 AND problem_id=$2`,
		userID, problemID,
	).Scan(&p.UserID, &p.ProblemID, &p.Status, &p.ClearedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return domain.Progress{UserID: userID, ProblemID: problemID, Status: domain.StatusTodo}, nil
		}
		return domain.Progress{}, fmt.Errorf("get progress: %w", err)
	}
	return p, nil
}

func (r *ProgressRepo) ListClearedProblemIDs(ctx context.Context, userID string) ([]int64, error) {
	rows, err := r.db.Query(ctx,
		`SELECT problem_id FROM progress WHERE user_id=$1 AND status='cleared' ORDER BY problem_id`,
		userID,
	)
	if err != nil {
		return nil, fmt.Errorf("list cleared: %w", err)
	}
	defer rows.Close()

	ids := []int64{}
	for rows.Next() {
		var id int64
		if err := rows.Scan(&id); err != nil {
			return nil, fmt.Errorf("scan cleared: %w", err)
		}
		ids = append(ids, id)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("rows cleared: %w", err)
	}
	return ids, nil
}

func (r *ProgressRepo) UpsertProgress(ctx context.Context, p domain.Progress) error {
	_, err := r.db.Exec(ctx,
		`INSERT INTO progress (user_id, problem_id, status, cleared_at)
		 VALUES ($1, $2, $3, $4)
		 ON CONFLICT (user_id, problem_id) DO UPDATE
		 SET status=EXCLUDED.status, cleared_at=EXCLUDED.cleared_at`,
		p.UserID, p.ProblemID, string(p.Status), p.ClearedAt,
	)
	return err
}
