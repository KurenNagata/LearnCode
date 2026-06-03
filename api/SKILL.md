---
name: api-first-regen
description: このプロジェクトで API のエンドポイントやリクエスト/レスポンスの形を追加・変更するときに使う。TypeSpec → OpenAPI → Go(oapi-codegen) の再生成フローと「生成コードは手編集しない」原則を扱う。
---

# API ファーストの再生成フロー

API を変更・追加するときは必ずこの手順を守る。Go の生成コードを直接書き換えてはいけない。

## 手順
1. `typespec/main.tsp` を編集して、操作（エンドポイント）やモデルを定義・変更する。
2. `task gen` を実行する（TypeSpec → OpenAPI 3.0 を出力し、続けて oapi-codegen で `api/internal/openapi/openapi.gen.go` を再生成する）。
3. 生成された server interface の新規/変更メソッドを `api/internal/handler/handler.go` で実装する。ハンドラは入出力の変換だけを行い、業務ロジックは service に委譲する。
4. 仕様変更は常に `main.tsp` で行う。生成物（`openapi.gen.go`、`typespec/tsp-output/`）は手で編集しない。

## 注意
- oapi-codegen との相性のため OpenAPI は 3.0 を出力する。
- 隠しテストケースの中身は API レスポンスに含めない。
