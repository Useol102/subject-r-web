<#
  Claude Code CLI 진단 및 설치

  "claude 용어가 cmdlet으로 인식되지 않습니다" 가 뜰 때 실행한다.
  이미 깔려 있으면 PATH만 고치고, 안 깔려 있으면 설치한다.

  실행:  .\fix-claude-cli.ps1
#>

$ErrorActionPreference = 'Continue'

Write-Host "`n=== 1. 이미 실행 가능한지 ===" -ForegroundColor Cyan
if (Get-Command claude -ErrorAction SilentlyContinue) {
    Write-Host "  claude 이미 사용 가능:" -ForegroundColor Green
    claude --version
    exit 0
}
Write-Host "  현재 창에서는 인식 안 됨" -ForegroundColor DarkYellow

Write-Host "`n=== 2. 디스크에 설치돼 있는지 검색 ===" -ForegroundColor Cyan
$candidates = @(
    "$env:USERPROFILE\.local\bin\claude.exe",
    "$env:LOCALAPPDATA\Programs\claude-code\claude.exe",
    "$env:LOCALAPPDATA\Microsoft\WinGet\Links\claude.exe",
    "$env:APPDATA\npm\claude.cmd",
    "$env:ProgramFiles\Claude Code\claude.exe"
)
$found = $candidates | Where-Object { Test-Path $_ } | Select-Object -First 1

if ($found) {
    # --- 설치는 됐고 PATH만 문제 ---
    Write-Host "  찾음: $found" -ForegroundColor Green
    $dir = Split-Path $found

    Write-Host "`n=== 3. PATH에 추가 ===" -ForegroundColor Cyan
    $userPath = [Environment]::GetEnvironmentVariable("Path", "User")
    if ($userPath -split ';' -contains $dir) {
        Write-Host "  PATH에는 이미 있다. 이 창이 옛날 PATH를 들고 있는 것뿐이다." -ForegroundColor DarkYellow
    } else {
        [Environment]::SetEnvironmentVariable("Path", "$userPath;$dir", "User")
        Write-Host "  추가 완료: $dir" -ForegroundColor Green
    }

    # 현재 창에도 즉시 반영
    $env:Path += ";$dir"
    Write-Host "`n=== 4. 확인 ===" -ForegroundColor Cyan
    & $found --version
    Write-Host "`n이 창에서는 바로 쓸 수 있다." -ForegroundColor Green
    Write-Host "새 창에서도 되게 하려면 창을 닫고 다시 열 것." -ForegroundColor White
    exit 0
}

# --- 설치가 안 돼 있음 ---
Write-Host "  설치된 흔적 없음. 설치를 진행한다." -ForegroundColor Yellow

Write-Host "`n=== 3. 설치 ===" -ForegroundColor Cyan
try {
    Invoke-RestMethod https://claude.ai/install.ps1 | Invoke-Expression
} catch {
    Write-Host "  공식 설치 스크립트 실패: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "  winget으로 재시도..." -ForegroundColor Yellow
    winget install --id Anthropic.ClaudeCode -e --accept-source-agreements --accept-package-agreements
}

Write-Host "`n=== 4. 결과 ===" -ForegroundColor Cyan
$found = $candidates | Where-Object { Test-Path $_ } | Select-Object -First 1
if ($found) {
    $env:Path += ";" + (Split-Path $found)
    & $found --version
    Write-Host "`n설치 성공. 창을 닫고 새로 연 다음:" -ForegroundColor Green
    Write-Host "    cd `"F:\Subject R`"" -ForegroundColor White
    Write-Host "    claude"             -ForegroundColor White
} else {
    Write-Host "  설치가 안 됐다. 위에 뜬 메시지를 그대로 물어볼 것." -ForegroundColor Red
}
