package config

import (
	"log"
	"os"
)

// defaultJWTSecret は開発用のフォールバック。本番では必ず JWT_SECRET を設定すること。
const defaultJWTSecret = "dev-secret-change-me"

type Config struct {
	DatabaseURL   string
	PistonURL     string
	Port          string
	DefaultUserID string
	JWTSecret     string
	Env           string
	StaticDir     string
}

func Load() *Config {
	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		log.Fatal("DATABASE_URL is not set (copy .env.example to .env and fill in the values)")
	}

	env := getEnv("APP_ENV", "development")
	jwtSecret := getEnv("JWT_SECRET", defaultJWTSecret)

	// 本番では既定の JWT_SECRET のままの起動を拒否する（トークン偽造を防ぐ）。
	if env == "production" && jwtSecret == defaultJWTSecret {
		log.Fatal("JWT_SECRET must be set to a strong random value in production (APP_ENV=production)")
	}

	return &Config{
		DatabaseURL:   dbURL,
		PistonURL:     getEnv("PISTON_URL", "http://localhost:2000"),
		Port:          getEnv("PORT", "8080"),
		DefaultUserID: getEnv("DEFAULT_USER_ID", "00000000-0000-0000-0000-000000000001"),
		JWTSecret:     jwtSecret,
		Env:           env,
		// STATIC_DIR を指定すると、API と同一オリジンでフロントの静的ファイルを配信する
		// （本番=Docker では /app/web）。未指定なら API のみ（ローカル開発は Vite が配信）。
		StaticDir: os.Getenv("STATIC_DIR"),
	}
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
