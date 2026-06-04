package main

import (
	"context"
	"log"
	"net/http"

	"learning_language/api/internal/config"
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
	pistonClient := piston.NewClient(cfg.PistonURL)

	problemSvc := service.NewProblemService(problemRepo)
	judgeSvc := service.NewJudgeService(problemRepo, progressRepo, pistonClient, cfg.DefaultUserID)
	progressSvc := service.NewProgressService(progressRepo, cfg.DefaultUserID)

	h := handler.NewHandler(problemSvc, judgeSvc, progressSvc)
	httpHandler := openapi.Handler(openapi.NewStrictHandler(h, nil))

	log.Printf("server listening on :%s", cfg.Port)
	if err := http.ListenAndServe(":"+cfg.Port, httpHandler); err != nil {
		log.Fatal(err)
	}
}
