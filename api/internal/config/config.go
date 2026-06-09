package config

import (
	"log"
	"os"
	"strings"
)

// defaultJWTSecret は開発用のフォールバック。本番では必ず JWT_SECRET を設定すること。
const defaultJWTSecret = "dev-secret-change-me"

type Config struct {
	DatabaseURL    string
	PistonURL      string
	GlotURL        string
	GlotToken      string
	Port           string
	DefaultUserID  string
	JWTSecret      string
	Env            string
	StaticDir      string
	AllowedOrigins []string
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

	glotToken := os.Getenv("GLOT_TOKEN")
	// 実行エンジンは glot.io。本番でトークン未設定だと採点が必ず失敗するため起動を止める。
	if env == "production" && glotToken == "" {
		log.Fatal("GLOT_TOKEN must be set (glot.io API token) in production (APP_ENV=production)")
	}

	return &Config{
		DatabaseURL:   dbURL,
		PistonURL:     getEnv("PISTON_URL", "http://localhost:2000/api/v2"),
		GlotURL:       getEnv("GLOT_URL", "https://glot.io/api/run"),
		GlotToken:     glotToken,
		Port:          getEnv("PORT", "8080"),
		DefaultUserID: getEnv("DEFAULT_USER_ID", "00000000-0000-0000-0000-000000000001"),
		JWTSecret:     jwtSecret,
		Env:           env,
		// STATIC_DIR を指定すると、API と同一オリジンでフロントの静的ファイルを配信する。
		// 分離構成（フロント=Cloudflare Workers / API=Cloud Run）では未指定でよい。
		StaticDir: os.Getenv("STATIC_DIR"),
		// 別オリジンのフロントからの fetch を許可するオリジン（カンマ区切り）。
		// 例: https://learncode.example.workers.dev 。未指定なら "*"（全許可）。
		AllowedOrigins: parseOrigins(os.Getenv("ALLOWED_ORIGINS")),
	}
}

func parseOrigins(s string) []string {
	if strings.TrimSpace(s) == "" {
		return []string{"*"}
	}
	var out []string
	for p := range strings.SplitSeq(s, ",") {
		if v := strings.TrimSpace(p); v != "" {
			out = append(out, v)
		}
	}
	if len(out) == 0 {
		return []string{"*"}
	}
	return out
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
