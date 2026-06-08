package handler

import (
	"net/http"
	"os"
	"path/filepath"
	"strings"
)

// SPAFileServer は dir 配下の静的ファイル（ビルド済みフロント）を配信する。
// 実ファイルが無いパスは index.html にフォールバックし、React の
// クライアントサイドルーティングを成立させる。
func SPAFileServer(dir string) http.Handler {
	fs := http.FileServer(http.Dir(dir))
	index := filepath.Join(dir, "index.html")
	root := filepath.Clean(dir)

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// パストラバーサル対策: dir の外に出ないことを確認する。
		full := filepath.Join(root, filepath.FromSlash(filepath.Clean("/"+r.URL.Path)))
		if full != root && !strings.HasPrefix(full, root+string(os.PathSeparator)) {
			http.Error(w, "invalid path", http.StatusBadRequest)
			return
		}
		if info, err := os.Stat(full); err == nil && !info.IsDir() {
			fs.ServeHTTP(w, r)
			return
		}
		// 実ファイルが無ければ SPA のエントリポイントを返す。
		http.ServeFile(w, r, index)
	})
}
