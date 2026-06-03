package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"path/filepath"

	"github.com/jackc/pgx/v5/pgxpool"

	"learning_language/api/internal/config"
)

type seedProblem struct {
	Language    string         `json:"language"`
	Level       string         `json:"level"`
	Order       int32          `json:"order"`
	Title       string         `json:"title"`
	Description string         `json:"description"`
	StarterCode string         `json:"starter_code"`
	Explanation string         `json:"explanation"`
	AnswerCode  string         `json:"answer_code"`
	TestCases   []seedTestCase `json:"test_cases"`
}

type seedTestCase struct {
	Stdin  string `json:"stdin"`
	Stdout string `json:"stdout"`
}

func main() {
	cfg := config.Load()

	ctx := context.Background()
	db, err := pgxpool.New(ctx, cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("db connect: %v", err)
	}
	defer db.Close()

	files, err := filepath.Glob("seed/**/*.json")
	if err != nil {
		log.Fatal(err)
	}

	for _, f := range files {
		data, err := os.ReadFile(f)
		if err != nil {
			log.Fatalf("read %s: %v", f, err)
		}

		var p seedProblem
		if err := json.Unmarshal(data, &p); err != nil {
			log.Fatalf("parse %s: %v", f, err)
		}

		var problemID int64
		err = db.QueryRow(ctx,
			`INSERT INTO problems (language, level, "order", title, description, starter_code, explanation, answer_code)
			 VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
			 ON CONFLICT (language,"order") DO UPDATE
			 SET title=EXCLUDED.title, description=EXCLUDED.description,
			     starter_code=EXCLUDED.starter_code, explanation=EXCLUDED.explanation, answer_code=EXCLUDED.answer_code
			 RETURNING id`,
			p.Language, p.Level, p.Order, p.Title, p.Description, p.StarterCode, p.Explanation, p.AnswerCode,
		).Scan(&problemID)
		if err != nil {
			log.Fatalf("insert problem %s: %v", f, err)
		}

		if _, err := db.Exec(ctx, `DELETE FROM test_cases WHERE problem_id=$1`, problemID); err != nil {
			log.Fatalf("delete test cases: %v", err)
		}

		for _, tc := range p.TestCases {
			if _, err := db.Exec(ctx,
				`INSERT INTO test_cases (problem_id, stdin, stdout, hidden) VALUES ($1,$2,$3,true)`,
				problemID, tc.Stdin, tc.Stdout,
			); err != nil {
				log.Fatalf("insert test case: %v", err)
			}
		}

		fmt.Printf("seeded: %s (id=%d, tests=%d)\n", filepath.Base(f), problemID, len(p.TestCases))
	}
	fmt.Println("seed done")
}
