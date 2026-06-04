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
	problemRepo  ProblemRepository
	progressRepo ProgressRepository
	executor     CodeExecutor
}

func NewJudgeService(problemRepo ProblemRepository, progressRepo ProgressRepository, executor CodeExecutor) *JudgeService {
	return &JudgeService{
		problemRepo:  problemRepo,
		progressRepo: progressRepo,
		executor:     executor,
	}
}

// normalizeOutput は出力比較前の正規化を行う。
// 末尾の改行を除去し、全角・半角の感嘆符（！↔!）のゆらぎを吸収する。
func normalizeOutput(s string) string {
	s = strings.TrimRight(s, "\r\n")
	s = strings.ReplaceAll(s, "！", "!")
	return s
}

func (s *JudgeService) Judge(ctx context.Context, problemID int64, language, code, userID string) (JudgeResult, error) {
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

		actual := normalizeOutput(result.Stdout)
		expected := normalizeOutput(tc.Stdout)
		if actual == expected && result.ExitCode == 0 && !result.TimedOut {
			passed++
		}
	}

	allPassed := total > 0 && passed == total

	if allPassed {
		now := time.Now()
		_ = s.progressRepo.UpsertProgress(ctx, domain.Progress{
			UserID:    userID,
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
