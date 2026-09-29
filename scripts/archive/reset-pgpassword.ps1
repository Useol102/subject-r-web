<#
  Subject R — postgres 계정 비밀번호 재설정

  PostgreSQL 설치할 때 정한 비밀번호를 모를 때 쓴다. 재설치할 필요 없다.
  원리: 인증 방식을 잠깐 'trust'(비번 없이 접속)로 바꾼 뒤 비밀번호를 새로 정하고,
        원래 설정으로 되돌린다. pg_hba.conf는 자동으로 백업된다.

  실행: PowerShell을 "관리자 권한"으로 열고
        cd "F:\Subject R"
        .\reset-pgpassword.ps1
#>
param(
    [string]$NewPassword = "devpass"
)

$ErrorActionPreference = 'Stop'

# --- 관리자 권한 확인 ---
$admin = ([Security.Principal.WindowsPrincipal] `
          [Security.Principal.WindowsIdentity]::GetCurrent()
         ).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $admin) {
    Write-Host "관리자 권한 PowerShell에서 실행할 것. (Win+X -> 터미널(관리자))" -ForegroundColor Red
    exit 1
}

# --- 설치 위치 찾기 ---
$hba = Get-ChildItem "$env:ProgramFiles\PostgreSQL\*\data\pg_hba.conf" -ErrorAction SilentlyContinue |
       Sort-Object FullName -Descending | Select-Object -First 1
if (-not $hba) {
    Write-Host "pg_hba.conf를 찾을 수 없다. PostgreSQL이 설치돼 있는지 확인할 것." -ForegroundColor Red
    exit 1
}
$dataDir = Split-Path $hba.FullName
$binDir  = Join-Path (Split-Path $dataDir) "bin"
$svc     = Get-Service -Name "postgresql*" -ErrorAction SilentlyContinue | Select-Object -First 1
if (-not $svc) {
    Write-Host "PostgreSQL 서비스를 찾을 수 없다." -ForegroundColor Red
    exit 1
}

Write-Host "데이터 폴더 : $dataDir"    -ForegroundColor DarkGray
Write-Host "서비스      : $($svc.Name)" -ForegroundColor DarkGray

# --- 백업 ---
$backup = "$($hba.FullName).backup"
if (-not (Test-Path $backup)) {
    Copy-Item $hba.FullName $backup
    Write-Host "백업 생성: $backup" -ForegroundColor DarkGray
}

try {
    # --- 1) trust 모드로 전환 ---
    Write-Host "`n[1/4] 인증을 잠시 trust로 변경..." -ForegroundColor Cyan
    $lines = (Get-Content $hba.FullName) `
        -replace '(^\s*(host|local)\s+\S+\s+\S+\s+(\S+\s+)?)(scram-sha-256|md5|password)', '$1trust'
    # BOM 없이 저장해야 한다. BOM이 붙으면 PostgreSQL이 pg_hba.conf 첫 줄을 못 읽는다.
    $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllLines($hba.FullName, $lines, $utf8NoBom)

    # --- 2) 서비스 재시작 ---
    Write-Host "[2/4] 서비스 재시작..." -ForegroundColor Cyan
    Restart-Service $svc.Name -Force
    Start-Sleep -Seconds 3

    # --- 3) 비밀번호 변경 ---
    Write-Host "[3/4] 비밀번호 변경..." -ForegroundColor Cyan
    $env:PGCLIENTENCODING = "UTF8"
    & "$binDir\psql.exe" -U postgres -d postgres -c "ALTER USER postgres PASSWORD '$NewPassword';"
    if ($LASTEXITCODE -ne 0) { throw "비밀번호 변경 실패" }
}
finally {
    # --- 4) 원래 설정 복구 (실패해도 반드시 실행된다) ---
    Write-Host "[4/4] 원래 인증 설정으로 복구..." -ForegroundColor Cyan
    Copy-Item $backup $hba.FullName -Force
    Restart-Service $svc.Name -Force
    Start-Sleep -Seconds 3
}

# --- 확인 ---
$env:PGPASSWORD = $NewPassword
# psql에 넘기는 -c 문자열은 반드시 ASCII만. 한글을 넣으면 콘솔이 CP949로 인코딩해
# 넘기는데 PGCLIENTENCODING=UTF8과 어긋나 "0xc1 0xa2" 같은 인코딩 에러가 난다.
& "$binDir\psql.exe" -U postgres -d postgres -c "SELECT 1" 2>&1 | Out-Null
if ($LASTEXITCODE -eq 0) {
    Write-Host "`n성공. postgres 비밀번호는 이제 '$NewPassword' 다." -ForegroundColor Green
    Write-Host "이어서 실행할 것:  .\init-db.ps1" -ForegroundColor White
} else {
    Write-Host "`n복구는 됐지만 새 비밀번호로 접속이 안 된다. 화면 내용을 그대로 물어볼 것." -ForegroundColor Red
}
$env:PGPASSWORD = $null
