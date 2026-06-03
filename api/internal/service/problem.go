package service

import (
	"context"

	"learning_language/api/internal/domain"
)

type ProblemService struct {
	repo ProblemRepository
}

func NewProblemService(repo ProblemRepository) *ProblemService {
	return &ProblemService{repo: repo}
}

func (s *ProblemService) ListProblems(ctx context.Context, language string) ([]domain.Problem, error) {
	return s.repo.ListProblems(ctx, language)
}

func (s *ProblemService) GetProblem(ctx context.Context, id int64) (domain.Problem, error) {
	return s.repo.GetProblemByID(ctx, id)
}
