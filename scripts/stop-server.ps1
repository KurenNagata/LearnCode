param([int]$Port = 8080)

$stopped = $false

# ポートを使っているプロセスを終了
$conns = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
foreach ($conn in $conns) {
    $procId = $conn.OwningProcess
    Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
    $stopped = $true
}

# go run の親プロセスも終了（go.exe が子にサーバーを持つ場合）
$goProcs = Get-Process -Name "go" -ErrorAction SilentlyContinue
foreach ($p in $goProcs) {
    Stop-Process -Id $p.Id -Force -ErrorAction SilentlyContinue
    $stopped = $true
}

if ($stopped) {
    Start-Sleep -Milliseconds 500
    Write-Host "server stopped (port $Port)"
} else {
    Write-Host "server not running on port $Port"
}
