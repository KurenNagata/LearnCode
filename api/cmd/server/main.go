package main

import (
	"context"
	"errors"
	"log"
	"net/http"

	"learning_language/api/internal/config"
	"learning_language/api/internal/domain"
	"learning_language/api/internal/handler"
	"learning_language/api/internal/openapi"
	"learning_language/api/internal/piston"
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
	pistonClient := piston.NewClient(cfg.PistonURL)

	problemSvc := service.NewProblemService(problemRepo)
	judgeSvc := service.NewJudgeService(problemRepo, progressRepo, pistonClient)
	progressSvc := service.NewProgressService(progressRepo)
	authSvc := service.NewAuthService(userRepo, cfg.JWTSecret)

	h := handler.NewHandler(problemSvc, judgeSvc, progressSvc, authSvc)
	strict := openapi.NewStrictHandlerWithOptions(h, nil, openapi.StrictHTTPServerOptions{
		ResponseErrorHandlerFunc: errorToStatus,
	})
	httpHandler := handler.AuthMiddleware(cfg.JWTSecret, openapi.Handler(strict))

	log.Printf("server listening on :%s", cfg.Port)
	if err := http.ListenAndServe(":"+cfg.Port, httpHandler); err != nil {
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
