package main

import (
	"context"
	"errors"
	"log"
	"net/http"

	"learning_language/api/internal/config"
	"learning_language/api/internal/domain"
	"learning_language/api/internal/glot"
	"learning_language/api/internal/handler"
	"learning_language/api/internal/openapi"
	"learning_language/api/internal/repository"
	"learning_language/api/internal/service"
)

func main() {
	cfg := config.Load()

	ctx := context.Background()
	db, err := repository.NewPool(ctx, cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("db connect: %v", err)
	}
	defer db.Close()

	problemRepo := repository.NewProblemRepo(db)
	progressRepo := repository.NewProgressRepo(db)
	userRepo := repository.NewUserRepo(db)
	executor := glot.NewClient(cfg.GlotURL, cfg.GlotToken)

	problemSvc := service.NewProblemService(problemRepo)
	judgeSvc := service.NewJudgeService(problemRepo, progressRepo, executor)
	progressSvc := service.NewProgressService(progressRepo)
	authSvc := service.NewAuthService(userRepo, cfg.JWTSecret)

	h := handler.NewHandler(problemSvc, judgeSvc, progressSvc, authSvc)
	strict := openapi.NewStrictHandlerWithOptions(h, nil, openapi.StrictHTTPServerOptions{
		ResponseErrorHandlerFunc: errorToStatus,
	})
	apiHandler := handler.AuthMiddleware(cfg.JWTSecret, openapi.Handler(strict))

	// トップレベルで /api/* を API ハンドラへ、それ以外をフロントの静的配信へ振り分ける。
	// STATIC_DIR 未指定（ローカル開発）のときはフロントは Vite が配信するため API のみ。
	mux := http.NewServeMux()
	mux.Handle("/api/", apiHandler)
	if cfg.StaticDir != "" {
		mux.Handle("/", handler.SPAFileServer(cfg.StaticDir))
		log.Printf("serving frontend from %s", cfg.StaticDir)
	}

	// 別オリジン（Cloudflare Workers のフロント）からの fetch を許可するため
	// CORS を最外層に置き、プリフライトを認証より先に処理する。
	root := handler.CORS(cfg.AllowedOrigins, mux)

	log.Printf("server listening on :%s", cfg.Port)
	if err := http.ListenAndServe(":"+cfg.Port, root); err != nil {
		log.Fatal(err)
	}
}

// errorToStatus はサービス層のエラーを HTTP ステータスに対応づける。
func errorToStatus(w http.ResponseWriter, _ *http.Request, err error) {
	status := http.StatusInternalServerError
	switch {
	case errors.Is(err, service.ErrInvalidInput):
		status = http.StatusBadRequest
	case errors.Is(err, service.ErrInvalidCredentials):
		status = http.StatusUnauthorized
	case errors.Is(err, domain.ErrUserExists):
		status = http.StatusConflict
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_, _ = w.Write([]byte(`{"error":"` + err.Error() + `"}`))
}
