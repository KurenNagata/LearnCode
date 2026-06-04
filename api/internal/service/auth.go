package service

import (
	"context"
	"errors"

	"golang.org/x/crypto/bcrypt"

	"learning_language/api/internal/domain"
	"learning_language/api/internal/token"
)

var (
	// ErrInvalidInput はユーザー名・パスワードが要件を満たさない。
	ErrInvalidInput = errors.New("invalid input")
	// ErrInvalidCredentials はログイン失敗（ユーザー無し or パスワード不一致）。
	ErrInvalidCredentials = errors.New("invalid credentials")
)

// AuthService はサインアップ／ログインを担う。
type AuthService struct {
	users     UserRepository
	jwtSecret string
}

func NewAuthService(users UserRepository, jwtSecret string) *AuthService {
	return &AuthService{users: users, jwtSecret: jwtSecret}
}

// Signup はユーザーを作成し、トークンを返す。ユーザー名重複は domain.ErrUserExists。
func (s *AuthService) Signup(ctx context.Context, username, password string) (string, error) {
	if len(username) < 3 || len(username) > 50 || len(password) < 4 {
		return "", ErrInvalidInput
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return "", err
	}
	u, err := s.users.CreateUser(ctx, username, string(hash))
	if err != nil {
		return "", err // domain.ErrUserExists を含む
	}
	return token.Issue(s.jwtSecret, u.Username)
}

// UpdateAccount は現在のパスワードで本人確認し、ユーザー名／パスワードを更新する。
// 更新後のユーザー名と、新しいトークンを返す。
func (s *AuthService) UpdateAccount(ctx context.Context, currentUsername, currentPassword string, newUsername, newPassword *string) (token2 string, finalUsername string, err error) {
	u, err := s.users.GetUserByUsername(ctx, currentUsername)
	if err != nil {
		return "", "", ErrInvalidCredentials
	}
	if bcrypt.CompareHashAndPassword([]byte(u.PasswordHash), []byte(currentPassword)) != nil {
		return "", "", ErrInvalidCredentials
	}

	finalUsername = currentUsername

	if newUsername != nil && *newUsername != "" && *newUsername != currentUsername {
		if len(*newUsername) < 3 || len(*newUsername) > 50 {
			return "", "", ErrInvalidInput
		}
		if err := s.users.UpdateUsername(ctx, currentUsername, *newUsername); err != nil {
			return "", "", err // domain.ErrUserExists を含む
		}
		finalUsername = *newUsername
	}

	if newPassword != nil && *newPassword != "" {
		if len(*newPassword) < 4 {
			return "", "", ErrInvalidInput
		}
		hash, err := bcrypt.GenerateFromPassword([]byte(*newPassword), bcrypt.DefaultCost)
		if err != nil {
			return "", "", err
		}
		if err := s.users.UpdatePassword(ctx, finalUsername, string(hash)); err != nil {
			return "", "", err
		}
	}

	tok, err := token.Issue(s.jwtSecret, finalUsername)
	if err != nil {
		return "", "", err
	}
	return tok, finalUsername, nil
}

// Login は認証してトークンを返す。失敗は ErrInvalidCredentials。
func (s *AuthService) Login(ctx context.Context, username, password string) (string, error) {
	u, err := s.users.GetUserByUsername(ctx, username)
	if err != nil {
		if errors.Is(err, domain.ErrUserNotFound) {
			return "", ErrInvalidCredentials
		}
		return "", err
	}
	if bcrypt.CompareHashAndPassword([]byte(u.PasswordHash), []byte(password)) != nil {
		return "", ErrInvalidCredentials
	}
	return token.Issue(s.jwtSecret, u.Username)
}
