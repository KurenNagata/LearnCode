package service

import (
	"context"

	"learning_language/api/internal/domain"
)

type ProblemRepository interface {
	ListProblems(ctx context.Context, language string) ([]domain.Problem, error)
	GetProblemByID(ctx context.Context, id int64) (domain.Problem, error)
	GetTestCasesByProblemID(ctx context.Context, problemID int64) ([]domain.TestCase, error)
}

type ProgressRepository interface {
	GetProgress(ctx context.Context, userID string, problemID int64) (domain.Progress, error)
	UpsertProgress(ctx context.Context, progress domain.Progress) error
}

type CodeExecutor interface {
	Execute(ctx context.Context, req ExecuteRequest) (ExecuteResult, error)
}

type ExecuteRequest struct {
	Language string
	Code     string
	Stdin    string
}

type ExecuteResult struct {
	Stdout   string
	Stderr   string
	ExitCode int
	TimedOut bool
}
