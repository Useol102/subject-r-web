<#
  Subject R — DB / 웹 개발환경 설치 (Windows, Docker 없이)

  실행: PowerShell을 "관리자 권한"으로 열고
        cd "F:\Subject R"
        Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
        .\setup-windows.ps1

  가상화(WSL2/Hyper-V)를 쓰지 않는다. PostgreSQL을 Windows에 직접 설치한다.
  이미 깔린 건 건너뛴다. 여러 번 돌려도 안전하다.
#>

$ErrorActionPreference = 'Continue'
function Test-Cmd($n) { [bool](Get-Command $n -ErrorAction SilentlyContinue) }

function Install-IfMissing($cmd, $id, $label) {
    if (Test-Cmd $cmd) { Write-Host ("  [건너뜀] {0} — 이미 있음" -f $label) -ForegroundColor DarkGray; return }
    Write-Host ("  [설치] {0} ..." -f $label) -ForegroundColor Yellow
    winget install --id $id -e --accept-source-agreements --accept-package-agreements
    if ($LASTEXITCODE -eq 0) { Write-Host ("  [완료] {0}" -f $label) -ForegroundColor Green }
    else { Write-Host ("  [실패] {0} — 수동 설치 필요" -f $label) -ForegroundColor Red }
}

Write-Host "`n=== 0. winget 확인 ===" -ForegroundColor Cyan
if (-not (Test-Cmd winget)) {
    Write-Host "winget 없음. Microsoft Store에서 '앱 설치 관리자' 설치 후 다시." -ForegroundColor Red; exit 1
}
Write-Host "  OK"

Write-Host "`n=== 1. 현재 상태 ===" -ForegroundColor Cyan
foreach ($c in @('conda','python','git','node','psql')) {
    if (Test-Cmd $c) { Write-Host ("  O {0,-7} {1}" -f $c, (& $c --version 2>&1 | Select-Object -First 1)) }
    else            { Write-Host ("  X {0,-7} 없음" -f $c) -ForegroundColor DarkYellow }
}

Write-Host "`n=== 2. PostgreSQL 16 ===" -ForegroundColor Cyan
$pgExe = Get-ChildItem "$env:ProgramFiles\PostgreSQL\*\bin\psql.exe" -ErrorAction SilentlyContinue
if ($pgExe) {
    Write-Host "  [건너뜀] PostgreSQL — 이미 설치됨: $($pgExe[0].FullName)" -ForegroundColor DarkGray
} else {
    Write-Host "  [설치] PostgreSQL 16 ..." -ForegroundColor Yellow
    Write-Host "  >>> 설치 마법사가 뜨면 아래대로 할 것 <<<" -ForegroundColor Magenta
    Write-Host "      - Password: 기억할 수 있는 걸로. 나중에 .env에 넣는다 (예: devpass)"
    Write-Host "      - Port: 5432 (기본값 그대로)"
    Write-Host "      - Locale: 기본값 그대로"
    Write-Host "      - 마지막 'Stack Builder' 체크박스는 켜둘 것 (PostGIS를 여기서 깐다)"
    winget install --id PostgreSQL.PostgreSQL.16 -e --accept-source-agreements --accept-package-agreements
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  winget 실패. https://www.postgresql.org/download/windows/ 에서 직접 받을 것." -ForegroundColor Red
    }
}

Write-Host "`n=== 3. PostGIS (중요) ===" -ForegroundColor Cyan
Write-Host "  PostGIS는 winget으로 안 깔린다. Stack Builder로 설치할 것:" -ForegroundColor Yellow
Write-Host "    1) 시작 메뉴 -> 'Stack Builder' 실행"
Write-Host "    2) 드롭다운에서 PostgreSQL 16 선택 -> Next"
Write-Host "    3) [Spatial Extensions] 펼치기 -> 'PostGIS 3.x Bundle for PostgreSQL 16' 체크"
Write-Host "    4) Next -> Next -> 설치. 중간에 'Create spatial database?' 는 No 눌러도 된다"
Write-Host "  (이미 깔았으면 건너뛸 것)" -ForegroundColor DarkGray

Write-Host "`n=== 4. 도구 ===" -ForegroundColor Cyan
Install-IfMissing 'git'  'Git.Git'           'Git'
Install-IfMissing 'node' 'OpenJS.NodeJS.LTS' 'Node.js 20 LTS  (9월 프론트용)'

Write-Host "`n=== 5. Python 환경 ===" -ForegroundColor Cyan
if (Test-Cmd conda) {
    Write-Host "  Anaconda 있음. base를 더럽히지 말고 전용 환경을 팔 것:" -ForegroundColor Green
    Write-Host "      conda create -n sbr python=3.11 -y"  -ForegroundColor White
    Write-Host "      conda activate sbr"                  -ForegroundColor White
    Write-Host "      pip install -r requirements.txt"     -ForegroundColor White
} elseif (Test-Cmd python) {
    Write-Host "      python -m venv .venv"                -ForegroundColor White
    Write-Host "      .\.venv\Scripts\Activate.ps1"        -ForegroundColor White
    Write-Host "      pip install -r requirements.txt"     -ForegroundColor White
} else {
    Install-IfMissing 'python' 'Python.Python.3.11' 'Python 3.11'
}

Write-Host "`n=== 다음 ===" -ForegroundColor Cyan
Write-Host "  PostgreSQL과 PostGIS 설치가 끝났으면:"
Write-Host "      .\init-db.ps1" -ForegroundColor White
Write-Host "  DB 생성 + 테이블 9개 + 시드 데이터가 한 번에 들어간다.`n"
