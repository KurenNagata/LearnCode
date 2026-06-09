// Package glot は glot.io の Run API を使ってコードを実行するクライアント。
// service.CodeExecutor を満たし、Piston クライアントと差し替え可能。
package glot

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"learning_language/api/internal/service"
)

const defaultBaseURL = "https://glot.io/api/run"

type Client struct {
	baseURL    string
	token      string
	httpClient *http.Client
}

// NewClient は glot クライアントを作る。baseURL が空なら公開エンドポイントを使う。
// token は glot.io のアカウントページで発行する API トークン。
func NewClient(baseURL, token string) *Client {
	if baseURL == "" {
		baseURL = defaultBaseURL
	}
	return &Client{
		baseURL:    strings.TrimRight(baseURL, "/"),
		token:      token,
		httpClient: &http.Client{Timeout: 30 * time.Second},
	}
}

type runRequest struct {
	Files []codeFile `json:"files"`
	Stdin string     `json:"stdin"`
}

type codeFile struct {
	Name    string `json:"name"`
	Content string `json:"content"`
}

type runResponse struct {
	Stdout  string `json:"stdout"`
	Stderr  string `json:"stderr"`
	Error   string `json:"error"`   // 実行エラー（タイムアウト等）
	Message string `json:"message"` // 認証失敗などの API エラー時に返る
}

// 言語IDごとのソースファイル名。
// Java は glot が `java Main` を実行するため Main.java（クラスは Main）に固定する。
var fileName = map[string]string{
	"python":     "main.py",
	"javascript": "main.js",
	"java":       "Main.java",
	"c":          "main.c",
	"cpp":        "main.cpp",
	"csharp":     "main.cs",
	"go":         "main.go",
}

func (c *Client) Execute(ctx context.Context, req service.ExecuteRequest) (service.ExecuteResult, error) {
	name := fileName[req.Language]
	if name == "" {
		name = "main." + req.Language
	}

	body := runRequest{
		Files: []codeFile{{Name: name, Content: req.Code}},
		Stdin: req.Stdin,
	}
	data, err := json.Marshal(body)
	if err != nil {
		return service.ExecuteResult{}, fmt.Errorf("marshal: %w", err)
	}

	url := c.baseURL + "/" + req.Language + "/latest"
	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(data))
	if err != nil {
		return service.ExecuteResult{}, fmt.Errorf("new request: %w", err)
	}
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("Authorization", "Token "+c.token)

	resp, err := c.httpClient.Do(httpReq)
	if err != nil {
		return service.ExecuteResult{}, fmt.Errorf("glot run: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		var er runResponse
		_ = json.NewDecoder(resp.Body).Decode(&er)
		if er.Message != "" {
			return service.ExecuteResult{}, fmt.Errorf("glot status %d: %s", resp.StatusCode, er.Message)
		}
		return service.ExecuteResult{}, fmt.Errorf("glot status %d", resp.StatusCode)
	}

	var runResp runResponse
	if err := json.NewDecoder(resp.Body).Decode(&runResp); err != nil {
		return service.ExecuteResult{}, fmt.Errorf("decode response: %w", err)
	}

	// glot は終了コードを返さないため、error フィールドで失敗を判定する。
	// 採点は基本的に stdout の一致で行うので、ここは補助的な判定。
	exitCode := 0
	timedOut := false
	if runResp.Error != "" {
		exitCode = 1
		low := strings.ToLower(runResp.Error)
		if strings.Contains(low, "too long") || strings.Contains(low, "timeout") {
			timedOut = true
		}
	}

	return service.ExecuteResult{
		Stdout:   runResp.Stdout,
		Stderr:   runResp.Stderr,
		ExitCode: exitCode,
		TimedOut: timedOut,
	}, nil
}
