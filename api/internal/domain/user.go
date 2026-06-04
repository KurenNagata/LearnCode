package domain

import (
	"errors"
	"time"
)

// User はログインユーザー。
type User struct {
	ID           int64
	Username     string
	PasswordHash string
	CreatedAt    time.Time
}

// repository が返すユーザー関連のセンチネルエラー（service が判定に使う）。
var (
	ErrUserExists   = errors.New("user already exists")
	ErrUserNotFound = errors.New("user not found")
)
