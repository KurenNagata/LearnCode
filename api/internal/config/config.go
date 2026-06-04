package config

import (
	"log"
	"os"
)

type Config struct {
	DatabaseURL   string
	PistonURL     string
	Port          string
	DefaultUserID string
	JWTSecret     string
}

func Load() *Config {
	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		log.Fatal("DATABASE_URL is not set (copy .env.example to .env and fill in the values)")
	}
	return &Config{
		DatabaseURL:   dbURL,
		PistonURL:     getEnv("PISTON_URL", "http://localhost:2000"),
		Port:          getEnv("PORT", "8080"),
		DefaultUserID: getEnv("DEFAULT_USER_ID", "00000000-0000-0000-0000-000000000001"),
		JWTSecret:     getEnv("JWT_SECRET", "dev-secret-change-me"),
	}
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
