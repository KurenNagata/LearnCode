package piston

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"learning_language/api/internal/service"
)

type Client struct {
	baseURL    string
	httpClient *http.Client
}

func NewClient(baseURL string) *Client {
	return &Client{
		baseURL:    baseURL,
		httpClient: &http.Client{Timeout: 30 * time.Second},
	}
}

type execRequest struct {
	Language    string     `json:"language"`
	Version     string     `json:"version"`
	Files       []codeFile `json:"files"`
	Stdin       string     `json:"stdin"`
	RunTimeout  int        `json:"run_timeout"`
	MemoryLimit int        `json:"memory_limit"`
}

type codeFile struct {
	Name    string `json:"name"`
	Content string `json:"content"`
}

type execResponse struct {
	Run struct {
		Stdout string  `json:"stdout"`
		Stderr string  `json:"stderr"`
		Code   int     `json:"code"`
		Signal *string `json:"signal"`
	} `json:"run"`
}

func (c *Client) Execute(ctx context.Context, req service.ExecuteRequest) (service.ExecuteResult, error) {
	filename := "main.py"
	if req.Language != "python" {
		filename = "main." + req.Language
	}

	body := execRequest{
		Language:    req.Language,
		Version:     "*",
		Files:       []codeFile{{Name: filename, Content: req.Code}},
		Stdin:       req.Stdin,
		RunTimeout:  3000,
		MemoryLimit: 100_000_000,
	}

	data, err := json.Marshal(body)
	if err != nil {
		return service.ExecuteResult{}, fmt.Errorf("marshal: %w", err)
	}

	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, c.baseURL+"/api/v2/execute", bytes.NewReader(data))
	if err != nil {
		return service.ExecuteResult{}, fmt.Errorf("new request: %w", err)
	}
	httpReq.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(httpReq)
	if err != nil {
		return service.ExecuteResult{}, fmt.Errorf("piston execute: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return service.ExecuteResult{}, fmt.Errorf("piston status %d", resp.StatusCode)
	}

	var execResp execResponse
	if err := json.NewDecoder(resp.Body).Decode(&execResp); err != nil {
		return service.ExecuteResult{}, fmt.Errorf("decode response: %w", err)
	}

	timedOut := execResp.Run.Signal != nil && *execResp.Run.Signal == "SIGKILL"
	return service.ExecuteResult{
		Stdout:   execResp.Run.Stdout,
		Stderr:   execResp.Run.Stderr,
		ExitCode: execResp.Run.Code,
		TimedOut: timedOut,
	}, nil
}
