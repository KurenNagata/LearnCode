package service

import "context"

// ProgressService はユーザーの学習進捗（クリア済み問題）を扱う。
type ProgressService struct {
	repo ProgressRepository
}

func NewProgressService(repo ProgressRepository) *ProgressService {
	return &ProgressService{repo: repo}
}

// ListClearedProblemIDs は指定ユーザーのクリア済み問題IDの一覧を返す。
func (s *ProgressService) ListClearedProblemIDs(ctx context.Context, userID string) ([]int64, error) {
	return s.repo.ListClearedProblemIDs(ctx, userID)
}
