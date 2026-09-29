# SQLite 웹 데이터베이스 백업. PowerShell에서: .\backup-web.ps1
param(
    [ValidateRange(1, 100000)]
    [int]$Keep = 30
)

$ErrorActionPreference = "Stop"
$python = Join-Path $PSScriptRoot ".venv\Scripts\python.exe"
if (-not (Test-Path -LiteralPath $python)) {
    Write-Host "[중단] .venv가 없습니다. docs/WEB-START.md의 설치 절차를 먼저 실행하세요." -ForegroundColor Red
    exit 1
}

Push-Location -LiteralPath $PSScriptRoot
try {
    & $python -m tools.backup_db --keep $Keep
    if ($LASTEXITCODE -ne 0) {
        exit $LASTEXITCODE
    }
} finally {
    Pop-Location
}
