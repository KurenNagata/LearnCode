#!/bin/sh
# 本番コンテナの起動シーケンス: マイグレーション → 問題投入 → サーバー起動。
# migrate/seed は upsert なので毎デプロイ実行しても冪等。
set -e

echo "[entrypoint] running migrations..."
/app/bin/migrate

echo "[entrypoint] seeding problems..."
/app/bin/seed

echo "[entrypoint] starting server..."
exec /app/bin/server
