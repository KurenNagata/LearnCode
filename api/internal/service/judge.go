package service

import (
	"context"
	"strings"
	"time"

	"learning_language/api/internal/domain"
)

type JudgeResult struct {
	Passed      bool
	TotalTests  int32
	PassedTests int32
}

type JudgeService struct {
	problemRepo   ProblemRepository
	progressRepo  ProgressRepository
	executor      CodeExecutor
	defaultUserID string
}

func NewJudgeService(problemRepo ProblemRepository, progressRepo ProgressRepository, executor CodeExecutor, defaultUserID string) *JudgeService {
	return &JudgeService{
		problemRepo:   problemRepo,
		progressRepo:  progressRepo,
		executor:      executor,
		defaultUserID: defaultUserID,
	}
}

func (s *JudgeService) Judge(ctx context.Context, problemID int64, language, code string) (JudgeResult, error) {
	testCases, err := s.problemRepo.GetTestCasesByProblemID(ctx, problemID)
	if err != nil {
		return JudgeResult{}, err
	}

	total := int32(len(testCases))
	var passed int32

	for _, tc := range testCases {
		result, err := s.executor.Execute(ctx, ExecuteRequest{
			Language: language,
			Code:     code,
			Stdin:    tc.Stdin,
		})
		if err != nil {
			return JudgeResult{}, err
		}

		actual := strings.TrimRight(result.Stdout, "\r\n")
		expected := strings.TrimRight(tc.Stdout, "\r\n")
		if actual == expected && result.ExitCode == 0 && !result.TimedOut {
			passed++
		}
	}

	allPassed := total > 0 && passed == total

	if allPassed {
		now := time.Now()
		_ = s.progressRepo.UpsertProgress(ctx, domain.Progress{
			UserID:    s.defaultUserID,
			ProblemID: problemID,
			Status:    domain.StatusCleared,
			ClearedAt: &now,
		})
	}

	return JudgeResult{
		Passed:      allPassed,
		TotalTests:  total,
		PassedTests: passed,
	}, nil
}
