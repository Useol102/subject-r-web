<#
  Subject R — DB 생성 및 스키마 적용

  실행:  .\init-db.ps1
  초기화 후 다시:  .\init-db.ps1 -Recreate

  PostgreSQL과 PostGIS가 먼저 설치돼 있어야 한다 (setup-windows.ps1 참고).
#>
param(
    [string]$DbName   = "robotdb",
    [string]$DbUser   = "postgres",
    [string]$DbPass   = "",
    [int]   $Port     = 5432,
    [switch]$Recreate          # 기존 DB를 지우고 처음부터 다시 만든다
)

$ErrorActionPreference = 'Stop'

# --- psql 찾기 ---
$psql = Get-ChildItem "$env:ProgramFiles\PostgreSQL\*\bin\psql.exe" -ErrorAction SilentlyContinue |
        Sort-Object FullName -Descending | Select-Object -First 1
if (-not $psql) {
    Write-Host "psql을 찾을 수 없다. PostgreSQL이 설치돼 있는지 확인할 것." -ForegroundColor Red
    exit 1
}
$bin = Split-Path $psql.FullName
Write-Host "psql: $($psql.FullName)" -ForegroundColor DarkGray

# --- 비밀번호 ---
if (-not $DbPass) {
    $sec  = Read-Host "PostgreSQL 설치할 때 정한 postgres 비밀번호" -AsSecureString
    $DbPass = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
              [Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec))
}
$env:PGPASSWORD       = $DbPass
$env:PGCLIENTENCODING = "UTF8"     # .sql 파일이 UTF-8이므로 필요하다
# psql이 UTF-8로 뱉는 메시지를 콘솔이 CP949로 읽어서 깨지는 걸 막는다.
# chcp까지 해야 확실하다. OutputEncoding만으로는 부족한 경우가 있다.
try { chcp 65001 > $null } catch { }
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch { }
# 주의: 아래 psql -c 문자열에는 한글을 쓰지 않는다.
# 콘솔이 인자를 CP949로 넘기는데 PGCLIENTENCODING=UTF8과 어긋나 인코딩 에러가 난다.

# --- 연결 확인 ---
& "$bin\psql.exe" -U $DbUser -p $Port -d postgres -c "SELECT 1" *> $null
if ($LASTEXITCODE -ne 0) {
    Write-Host "접속 실패. 비밀번호나 포트를 확인할 것." -ForegroundColor Red
    exit 1
}
Write-Host "접속 OK" -ForegroundColor Green

# --- PostGIS 설치 여부 확인 (DB를 만들기 전에 먼저 막는다) ---
$hasPostgis = & "$bin\psql.exe" -U $DbUser -p $Port -d postgres -tAc `
              "SELECT 1 FROM pg_available_extensions WHERE name='postgis'"
if ($hasPostgis -ne "1") {
    Write-Host ""
    Write-Host "PostGIS가 설치돼 있지 않다. 스키마에 좌표 컬럼이 있어 반드시 필요하다." -ForegroundColor Red
    Write-Host ""
    Write-Host "설치 방법:" -ForegroundColor Yellow
    Write-Host "  1) 시작 메뉴에서 'Stack Builder' 실행"
    Write-Host "     (없으면 직접: $($psql.Directory.Parent.FullName)\bin\stackbuilder.exe)"
    Write-Host "  2) PostgreSQL 16 선택 -> Next"
    Write-Host "  3) Spatial Extensions -> 'PostGIS Bundle for PostgreSQL 16' 체크"
    Write-Host "  4) Next -> 설치"
    Write-Host ""
    Write-Host "설치 후 다시 실행:  .\init-db.ps1 -Recreate" -ForegroundColor White
    exit 1
}
Write-Host "PostGIS OK" -ForegroundColor Green

# --- DB 생성 ---
if ($Recreate) {
    Write-Host "기존 $DbName 삭제..." -ForegroundColor Yellow
    & "$bin\psql.exe" -U $DbUser -p $Port -d postgres -c "DROP DATABASE IF EXISTS $DbName" *> $null
}

$exists = & "$bin\psql.exe" -U $DbUser -p $Port -d postgres -tAc `
          "SELECT 1 FROM pg_database WHERE datname='$DbName'"
if ($exists -eq "1") {
    Write-Host "$DbName 이미 있음. 처음부터 다시 만들려면:  .\init-db.ps1 -Recreate" -ForegroundColor DarkYellow
    exit 0
}

Write-Host "$DbName 생성 중 (UTF8)..." -ForegroundColor Cyan
& "$bin\createdb.exe" -U $DbUser -p $Port -E UTF8 -T template0 $DbName
if ($LASTEXITCODE -ne 0) { Write-Host "생성 실패" -ForegroundColor Red; exit 1 }

# --- 스키마 + 시드 ---
foreach ($f in @("schema\001_phase1.sql", "schema\002_seed_dev.sql")) {
    Write-Host "적용: $f" -ForegroundColor Cyan
    & "$bin\psql.exe" -U $DbUser -p $Port -d $DbName -v ON_ERROR_STOP=1 -q -f $f
    if ($LASTEXITCODE -ne 0) { Write-Host "  실패: $f" -ForegroundColor Red; exit 1 }
}

# --- 검증 ---
Write-Host "`n=== 검증 ===" -ForegroundColor Cyan
& "$bin\psql.exe" -U $DbUser -p $Port -d $DbName -c `
  "SELECT count(*) AS tables_created FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' AND table_name NOT IN ('spatial_ref_sys','alembic_version')"
& "$bin\psql.exe" -U $DbUser -p $Port -d $DbName -c "SELECT label, x, y FROM v_selectable_poi"

Write-Host "`n성공. .env의 DATABASE_URL을 아래로 맞출 것:" -ForegroundColor Green
Write-Host "  DATABASE_URL=postgresql+psycopg://${DbUser}:${DbPass}@localhost:${Port}/${DbName}" -ForegroundColor White
$env:PGPASSWORD = $null
