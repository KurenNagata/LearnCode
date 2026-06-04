package service

import "context"

// ProgressService はユーザーの学習進捗（クリア済み問題）を扱う。
type ProgressService struct {
	repo          ProgressRepository
	defaultUserID string
}

func NewProgressService(repo ProgressRepository, defaultUserID string) *ProgressService {
	return &ProgressService{repo: repo, defaultUserID: defaultUserID}
}

// ListClearedProblemIDs はクリア済み問題IDの一覧を返す。
func (s *ProgressService) ListClearedProblemIDs(ctx context.Context) ([]int64, error) {
	return s.repo.ListClearedProblemIDs(ctx, s.defaultUserID)
}
