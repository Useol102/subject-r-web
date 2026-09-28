# Subject R 웹 실행 스크립트 (SQLite 웹). PowerShell 에서: .\start-web.ps1
#
# 하는 일
#   1) 직원 비밀번호를 web-admin-key.txt 에서 읽어 환경변수로 넘긴다
#   2) DB 를 최신 마이그레이션까지 올린다
#   3) 화면을 빌드한 뒤 서버를 띄운다
#
# 비밀번호를 바꾸려면 web-admin-key.txt 파일 내용만 고치면 된다.
# 이 파일은 .gitignore 에 있어 깃허브에 올라가지 않는다.

param(
    [switch]$Lan,          # 폰·패드에서 볼 때. 같은 공유기의 누구나 접속할 수 있다.
    [int]$Port = 8000,
    [switch]$SkipBuild     # 화면을 안 고쳤을 때 빌드를 건너뛴다
)

$ErrorActionPreference = "Stop"
Set-Location -Path $PSScriptRoot

$python = ".\.venv\Scripts\python.exe"
if (-not (Test-Path $python)) {
    Write-Host "[중단] .venv 가 없습니다. 먼저 아래 두 줄을 실행하세요." -ForegroundColor Red
    Write-Host "  py -m venv .venv"
    Write-Host "  .\.venv\Scripts\python.exe -m pip install -r requirements-web.txt"
    exit 1
}

$keyFile = "web-admin-key.txt"
if (-not (Test-Path $keyFile)) {
    "1234" | Set-Content -Path $keyFile -Encoding UTF8 -NoNewline
    Write-Host "[안내] $keyFile 을 만들었습니다. 임시 비밀번호는 1234 입니다." -ForegroundColor Yellow
}
$env:WEB_ADMIN_KEY = (Get-Content $keyFile -Raw).Trim()
if (-not $env:WEB_ADMIN_KEY) {
    Write-Host "[중단] $keyFile 이 비어 있습니다. 비밀번호를 적어 주세요." -ForegroundColor Red
    exit 1
}
if ($env:WEB_ADMIN_KEY -eq "1234") {
    Write-Host "[경고] 비밀번호가 1234 입니다. 실제 회원 정보를 넣기 전에 $keyFile 에서 바꾸세요." -ForegroundColor Yellow
}

& $python -m alembic -c web-alembic.ini upgrade head
if (-not $SkipBuild) { npm --prefix web run build }

$bind = "127.0.0.1"
if ($Lan) {
    $bind = "0.0.0.0"
    Write-Host ""
    Write-Host "[주의] 같은 공유기에 있는 누구나 접속할 수 있는 상태로 띄웁니다." -ForegroundColor Yellow
    Write-Host "       공용 와이파이에서는 쓰지 말고, 확인이 끝나면 Ctrl+C 로 꺼 주세요."
    (Get-NetIPAddress -AddressFamily IPv4 |
        Where-Object { $_.IPAddress -notlike "127.*" -and $_.IPAddress -notlike "169.254.*" } |
        ForEach-Object { Write-Host ("       폰에서: http://" + $_.IPAddress + ":" + $Port + "/") })
    Write-Host ""
}

Write-Host "이용자 화면 http://127.0.0.1:$Port/  ·  직원 화면 /admin (비밀번호 필요)" -ForegroundColor Green
& $python -m uvicorn web_api.main:app --host $bind --port $Port
