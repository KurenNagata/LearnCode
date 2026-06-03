package repository

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5/pgxpool"

	"learning_language/api/internal/domain"
)

type ProblemRepo struct {
	db *pgxpool.Pool
}

func NewProblemRepo(db *pgxpool.Pool) *ProblemRepo {
	return &ProblemRepo{db: db}
}

func (r *ProblemRepo) ListProblems(ctx context.Context, language string) ([]domain.Problem, error) {
	query := `SELECT id, language, level, "order", title, description,
	           COALESCE(starter_code,''), COALESCE(explanation,''), COALESCE(answer_code,'')
	           FROM problems`
	args := []any{}
	if language != "" {
		query += " WHERE language = $1"
		args = append(args, language)
	}
	query += ` ORDER BY "order"`

	rows, err := r.db.Query(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("list problems: %w", err)
	}
	defer rows.Close()

	var problems []domain.Problem
	for rows.Next() {
		var p domain.Problem
		if err := rows.Scan(&p.ID, &p.Language, &p.Level, &p.Order, &p.Title, &p.Description,
			&p.StarterCode, &p.Explanation, &p.AnswerCode); err != nil {
			return nil, err
		}
		problems = append(problems, p)
	}
	return problems, rows.Err()
}

func (r *ProblemRepo) GetProblemByID(ctx context.Context, id int64) (domain.Problem, error) {
	var p domain.Problem
	err := r.db.QueryRow(ctx,
		`SELECT id, language, level, "order", title, description,
		 COALESCE(starter_code,''), COALESCE(explanation,''), COALESCE(answer_code,'')
		 FROM problems WHERE id = $1`,
		id,
	).Scan(&p.ID, &p.Language, &p.Level, &p.Order, &p.Title, &p.Description,
		&p.StarterCode, &p.Explanation, &p.AnswerCode)
	if err != nil {
		return domain.Problem{}, fmt.Errorf("get problem %d: %w", id, err)
	}
	return p, nil
}

func (r *ProblemRepo) GetTestCasesByProblemID(ctx context.Context, problemID int64) ([]domain.TestCase, error) {
	rows, err := r.db.Query(ctx,
		`SELECT id, problem_id, stdin, stdout, hidden FROM test_cases WHERE problem_id = $1 ORDER BY id`,
		problemID,
	)
	if err != nil {
		return nil, fmt.Errorf("get test cases: %w", err)
	}
	defer rows.Close()

	var tcs []domain.TestCase
	for rows.Next() {
		var tc domain.TestCase
		if err := rows.Scan(&tc.ID, &tc.ProblemID, &tc.Stdin, &tc.Stdout, &tc.Hidden); err != nil {
			return nil, err
		}
		tcs = append(tcs, tc)
	}
	return tcs, rows.Err()
}
