package handler

import "net/http"

// CORS は別オリジン（Cloudflare Workers のフロント）からの fetch を許可する。
// 認証ミドルウェアより外側に置き、プリフライト(OPTIONS)を先に 204 で返す。
// 認証は Bearer トークンで行い Cookie を使わないため、許可オリジンは
// リクエストの Origin をそのまま echo する（"*" 指定時は全許可）。
func CORS(allowed []string, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")
		if origin != "" && originAllowed(allowed, origin) {
			w.Header().Set("Access-Control-Allow-Origin", origin)
			w.Header().Add("Vary", "Origin")
			w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
			w.Header().Set("Access-Control-Allow-Headers", "Authorization, Content-Type")
			w.Header().Set("Access-Control-Max-Age", "86400")
		}
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func originAllowed(allowed []string, origin string) bool {
	for _, a := range allowed {
		if a == "*" || a == origin {
			return true
		}
	}
	return false
}
