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
