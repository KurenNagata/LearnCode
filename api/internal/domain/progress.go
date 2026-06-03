package domain

import "time"

type ProgressStatus string

const (
	StatusTodo       ProgressStatus = "todo"
	StatusInProgress ProgressStatus = "in_progress"
	StatusCleared    ProgressStatus = "cleared"
)

type Progress struct {
	UserID    string
	ProblemID int64
	Status    ProgressStatus
	ClearedAt *time.Time
}
