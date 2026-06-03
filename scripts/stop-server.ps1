param([int]$Port = 8080)
$conn = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
if ($conn) {
    Stop-Process -Id $conn.OwningProcess -Force
    Write-Host "server stopped (port $Port)"
} else {
    Write-Host "server not running on port $Port"
}
