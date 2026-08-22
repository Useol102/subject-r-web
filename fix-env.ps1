<#
  Subject R - .env 자동 설정 및 DB 연결 진단

  하는 일:
    1. .env 가 없으면 .env.example 에서 만든다
    2. SECRET_KEY 를 안전한 값으로 새로 발급한다
    3. PostgreSQL 서비스 상태를 확인한다
    4. 비밀번호를 실제로 시험해보고 맞는 것을 .env 에 넣는다
    5. robotdb 가 있는지 확인한다

  실행:  .\fix-env.ps1
#>
param(
    [string]$DbPassword = "",
    [string]$DbName     = "robotdb",
    [string]$DbUser     = "postgres",
    [int]   $Port       = 5432
)

$ErrorActionPreference = 'Continue'
try { chcp 65001 > $null } catch { }

Write-Host "`n=== 1. .env 준비 ===" -ForegroundColor Cyan
if (-not (Test-Path ".env")) {
    if (-not (Test-Path ".env.example")) {
        Write-Host "  .env.example 이 없다. 폴더가 맞는지 확인할 것." -ForegroundColor Red
        exit 1
    }
    Copy-Item ".env.example" ".env"
    Write-Host "  .env.example -> .env 복사 완료" -ForegroundColor Green
} else {
    Write-Host "  .env 이미 있음" -ForegroundColor DarkGray
}

# ---------- 2. SECRET_KEY ----------
Write-Host "`n=== 2. SECRET_KEY ===" -ForegroundColor Cyan
$envText = Get-Content ".env" -Raw -Encoding UTF8
$needKey = ($envText -match "SECRET_KEY=CHANGE_ME") -or ($envText -notmatch "SECRET_KEY=\S{32,}")

if ($needKey) {
    $bytes = New-Object byte[] 32
    [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
    $key = -join ($bytes | ForEach-Object { $_.ToString('x2') })
    $envText = $envText -replace "(?m)^SECRET_KEY=.*$", "SECRET_KEY=$key"
    Write-Host "  새로 발급 (64자)" -ForegroundColor Green
} else {
    Write-Host "  이미 설정됨" -ForegroundColor DarkGray
}

# ---------- 3. PostgreSQL 서비스 ----------
Write-Host "`n=== 3. PostgreSQL 서비스 ===" -ForegroundColor Cyan
$svc = Get-Service -Name "postgresql*" -ErrorAction SilentlyContinue | Select-Object -First 1
if (-not $svc) {
    Write-Host "  서비스를 찾을 수 없다. PostgreSQL이 설치되지 않았다." -ForegroundColor Red
    Write-Host "  .\setup-windows.ps1 을 먼저 실행할 것." -ForegroundColor White
    exit 1
}
Write-Host "  $($svc.Name) : $($svc.Status)"
if ($svc.Status -ne 'Running') {
    Write-Host "  꺼져 있다. 시작한다..." -ForegroundColor Yellow
    Start-Service $svc.Name
    Start-Sleep -Seconds 4
    $svc.Refresh()
    if ($svc.Status -ne 'Running') {
        Write-Host "  시작 실패. 관리자 권한으로 다시 실행할 것." -ForegroundColor Red
        exit 1
    }
    Write-Host "  시작됨" -ForegroundColor Green
}

# ---------- 4. 비밀번호 확인 ----------
Write-Host "`n=== 4. 비밀번호 확인 ===" -ForegroundColor Cyan
$psqlExe = Get-ChildItem "$env:ProgramFiles\PostgreSQL\*\bin\psql.exe" -EA SilentlyContinue |
           Sort-Object FullName -Descending | Select-Object -First 1
if (-not $psqlExe) {
    Write-Host "  psql.exe 를 찾을 수 없다." -ForegroundColor Red
    exit 1
}
$bin = Split-Path $psqlExe.FullName
$env:PGCLIENTENCODING = "UTF8"

function Test-Pw([string]$pw) {
    $env:PGPASSWORD = $pw
    & "$bin\psql.exe" -U $DbUser -p $Port -d postgres -tAc "SELECT 1" *> $null
    return ($LASTEXITCODE -eq 0)
}

$good = $null
if ($DbPassword) {
    if (Test-Pw $DbPassword) { $good = $DbPassword }
}
if (-not $good) {
    # .env 에 이미 적힌 값을 먼저 시험한다
    if ($envText -match "postgresql\+psycopg://[^:]+:([^@]+)@") {
        $fromEnv = $matches[1]
        if (Test-Pw $fromEnv) {
            $good = $fromEnv
            Write-Host "  .env 에 적힌 비밀번호가 맞다" -ForegroundColor Green
        }
    }
}
while (-not $good) {
    Write-Host "  PostgreSQL 설치할 때 정한 postgres 비밀번호를 입력할 것." -ForegroundColor Yellow
    Write-Host "  기억이 안 나면 창을 닫고:  .\reset-pgpassword.ps1" -ForegroundColor DarkGray
    $sec = Read-Host "  비밀번호 (그냥 Enter 치면 중단)" -AsSecureString
    $try = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
           [Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec))
    if (-not $try) { Write-Host "`n  중단했다." -ForegroundColor Red; exit 1 }
    if (Test-Pw $try) { $good = $try; Write-Host "  접속 성공" -ForegroundColor Green }
    else { Write-Host "  틀렸다. 다시." -ForegroundColor Red }
}

# ---------- 5. DB 존재 확인 ----------
Write-Host "`n=== 5. 데이터베이스 ===" -ForegroundColor Cyan
$env:PGPASSWORD = $good
$exists = & "$bin\psql.exe" -U $DbUser -p $Port -d postgres -tAc `
          "SELECT 1 FROM pg_database WHERE datname='$DbName'"
if ($exists -eq "1") {
    Write-Host "  $DbName 있음" -ForegroundColor Green
    $hasPostgis = & "$bin\psql.exe" -U $DbUser -p $Port -d $DbName -tAc `
                  "SELECT 1 FROM pg_extension WHERE extname='postgis'"
    if ($hasPostgis -eq "1") {
        $n = & "$bin\psql.exe" -U $DbUser -p $Port -d $DbName -tAc `
             "SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' AND table_name NOT IN ('spatial_ref_sys','alembic_version')"
        Write-Host "  PostGIS 설치됨 / 테이블 $($n.Trim())개" -ForegroundColor Green
    } else {
        Write-Host "  PostGIS 확장이 이 DB에 없다 -> .\init-db.ps1 -Recreate" -ForegroundColor Yellow
    }
} else {
    Write-Host "  $DbName 이 없다. 아직 만들지 않았다." -ForegroundColor Yellow
    Write-Host "  다음을 실행할 것:  .\init-db.ps1" -ForegroundColor White
}

# ---------- 6. .env 기록 ----------
Write-Host "`n=== 6. .env 기록 ===" -ForegroundColor Cyan
$url = "postgresql+psycopg://${DbUser}:${good}@localhost:${Port}/${DbName}"
$envText = $envText -replace "(?m)^DATABASE_URL=.*$", "DATABASE_URL=$url"
$envText = $envText -replace "(?m)^POSTGRES_USER=.*$",     "POSTGRES_USER=$DbUser"
$envText = $envText -replace "(?m)^POSTGRES_PASSWORD=.*$", "POSTGRES_PASSWORD=$good"
$envText = $envText -replace "(?m)^POSTGRES_DB=.*$",       "POSTGRES_DB=$DbName"

# .env 는 BOM 없이 UTF-8 로 저장한다. BOM이 붙으면 첫 줄 키 이름이 깨진다.
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText((Resolve-Path ".env").Path, $envText, $utf8NoBom)
Write-Host "  DATABASE_URL, SECRET_KEY 반영 완료" -ForegroundColor Green

$env:PGPASSWORD = $null
Write-Host "`n=== 다음 ===" -ForegroundColor Cyan
Write-Host "    .\.venv\Scripts\python.exe tools\preflight.py" -ForegroundColor Yellow
Write-Host ""
