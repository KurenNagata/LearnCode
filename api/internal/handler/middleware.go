package handler

import (
	"context"
	"net/http"
	"strings"

	"learning_language/api/internal/token"
)

type ctxKey string

const userIDKey ctxKey = "userID"

// UserIDFromContext は認証ミドルウェアが設定した user_id を取り出す。
func UserIDFromContext(ctx context.Context) (string, bool) {
	v, ok := ctx.Value(userIDKey).(string)
	return v, ok && v != ""
}

// AuthMiddleware は Bearer トークンを検証して user_id を context に載せる。
// 認証必須のルート（提出・進捗）にトークンが無ければ 401 を返す。
func AuthMiddleware(secret string, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()
		authz := r.Header.Get("Authorization")
		if after, ok := strings.CutPrefix(authz, "Bearer "); ok {
			if username, err := token.Parse(secret, after); err == nil {
				ctx = context.WithValue(ctx, userIDKey, username)
			}
		}
		if requiresAuth(r) {
			if _, ok := UserIDFromContext(ctx); !ok {
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusUnauthorized)
				_, _ = w.Write([]byte(`{"error":"unauthorized"}`))
				return
			}
		}
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

// requiresAuth は認証必須のルートか判定する（提出 POST .../submit と GET /api/progress）。
func requiresAuth(r *http.Request) bool {
	p := r.URL.Path
	if p == "/api/progress" {
		return true
	}
	if strings.HasPrefix(p, "/api/account/") {
		return true
	}
	if r.Method == http.MethodPost && strings.HasSuffix(p, "/submit") {
		return true
	}
	return false
}
