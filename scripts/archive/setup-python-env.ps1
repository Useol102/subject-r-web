<#
  Subject R - Python 가상환경 준비

  conda를 쓰지 않는다. 프로젝트 폴더 안에 .venv 를 만든다.

  실행:
      .\setup-python-env.ps1
      .\setup-python-env.ps1 -Recreate                     # 처음부터 다시
      .\setup-python-env.ps1 -PythonPath "C:\...\python.exe" -Recreate   # 버전 직접 지정
#>
param(
    [switch]$Recreate,
    [string]$PythonPath = ""
)

$ErrorActionPreference = 'Stop'

# 검증된 버전. 새로 나온 3.14 같은 건 라이브러리 지원이 덜 돼서 뒤로 미룬다.
$PREFERRED = @("3.13", "3.12", "3.11", "3.10")

Write-Host "`n=== 1. Python 찾는 중 ===" -ForegroundColor Cyan

$candidates = @()
if ($PythonPath) {
    $candidates += $PythonPath
} else {
    if (Get-Command python -ErrorAction SilentlyContinue) { $candidates += (Get-Command python).Source }
    $candidates += @(
        "$env:USERPROFILE\anaconda3\python.exe",
        "$env:USERPROFILE\Anaconda3\python.exe",
        "$env:USERPROFILE\miniconda3\python.exe",
        "C:\ProgramData\anaconda3\python.exe",
        "C:\ProgramData\Anaconda3\python.exe"
    )
    $candidates += (Get-ChildItem "$env:LOCALAPPDATA\Programs\Python\Python3*\python.exe" -EA SilentlyContinue |
                    ForEach-Object { $_.FullName })
    $candidates += (Get-ChildItem "C:\Python3*\python.exe" -EA SilentlyContinue |
                    ForEach-Object { $_.FullName })
    $candidates += (Get-ChildItem "$env:USERPROFILE\.pyenv\pyenv-win\versions\*\python.exe" -EA SilentlyContinue |
                    ForEach-Object { $_.FullName })
}

# 후보별 버전 조사
$found = @()
foreach ($p in ($candidates | Where-Object { $_ } | Select-Object -Unique)) {
    if (-not (Test-Path $p)) { continue }
    $v = (& $p -c "import sys; print('%d.%d' % sys.version_info[:2])" 2>$null)
    if ($v) { $found += [pscustomobject]@{ Path = $p; Version = $v.Trim() } }
}

if ($found.Count -eq 0) {
    Write-Host "  Python을 찾지 못했다." -ForegroundColor Red
    Write-Host "  설치:  winget install Python.Python.3.12" -ForegroundColor White
    Write-Host "  설치 후 창을 닫고 새로 연 다음 다시 실행할 것." -ForegroundColor White
    exit 1
}

Write-Host "  발견한 Python:" -ForegroundColor DarkGray
foreach ($f in $found) { Write-Host ("    {0,-6} {1}" -f $f.Version, $f.Path) -ForegroundColor DarkGray }

# 검증된 버전을 우선 고른다
$py = $null
foreach ($want in $PREFERRED) {
    $hit = $found | Where-Object { $_.Version -eq $want } | Select-Object -First 1
    if ($hit) { $py = $hit; break }
}
if (-not $py) {
    # 검증된 버전이 없으면 3.10 이상 중 가장 낮은 것 (안정성 우선)
    $py = $found |
          Where-Object { [int]($_.Version.Split('.')[1]) -ge 10 } |
          Sort-Object { [int]($_.Version.Split('.')[1]) } |
          Select-Object -First 1
    if ($py) {
        Write-Host "`n  주의: 검증된 버전($($PREFERRED -join ', '))이 없어 $($py.Version)을 쓴다." -ForegroundColor Yellow
        Write-Host "  패키지 설치나 실행이 실패하면 3.12를 설치하고 -Recreate로 다시 만들 것." -ForegroundColor Yellow
    }
}
if (-not $py) {
    Write-Host "`n  Python 3.10 이상이 필요하다 (models.py가 'str | None' 문법을 쓴다)." -ForegroundColor Red
    Write-Host "  winget install Python.Python.3.12" -ForegroundColor White
    exit 1
}
Write-Host "`n  선택: $($py.Path)  (Python $($py.Version))" -ForegroundColor Green

# ---------- 2. .venv ----------
Write-Host "`n=== 2. 가상환경 ===" -ForegroundColor Cyan
if ($Recreate -and (Test-Path ".venv")) {
    Write-Host "  기존 .venv 삭제..." -ForegroundColor Yellow
    Remove-Item ".venv" -Recurse -Force
}
if (Test-Path ".venv\Scripts\python.exe") {
    $cur = (& ".venv\Scripts\python.exe" -c "import sys; print('%d.%d' % sys.version_info[:2])").Trim()
    Write-Host "  .venv 이미 있음 (Python $cur). 다시 만들려면 -Recreate" -ForegroundColor DarkGray
} else {
    Write-Host "  생성 중..." -ForegroundColor Cyan
    & $py.Path -m venv .venv
    if ($LASTEXITCODE -ne 0) { Write-Host "  생성 실패" -ForegroundColor Red; exit 1 }
}

$venvPy = (Resolve-Path ".venv\Scripts\python.exe").Path

# ---------- 3. 패키지 ----------
Write-Host "`n=== 3. 패키지 설치 ===" -ForegroundColor Cyan
& $venvPy -m pip install --upgrade pip --quiet
& $venvPy -m pip install -r requirements.txt
if ($LASTEXITCODE -ne 0) {
    Write-Host "`n  설치 실패." -ForegroundColor Red
    Write-Host "  Python 버전이 너무 최신이라 휠(wheel)이 없을 수 있다. 3.12로 다시 시도:" -ForegroundColor Yellow
    Write-Host "    winget install Python.Python.3.12" -ForegroundColor White
    Write-Host "    .\setup-python-env.ps1 -Recreate" -ForegroundColor White
    exit 1
}

# ---------- 4. 확인 ----------
Write-Host "`n=== 4. 확인 ===" -ForegroundColor Cyan
& $venvPy -c "import fastapi, sqlalchemy, geoalchemy2, psycopg, alembic; print('  주요 패키지 import OK')"
if ($LASTEXITCODE -ne 0) { Write-Host "  import 실패" -ForegroundColor Red; exit 1 }

Write-Host "`n=== 완료 ===" -ForegroundColor Green
Write-Host "다음 순서:" -ForegroundColor White
Write-Host "    .\.venv\Scripts\Activate.ps1"          -ForegroundColor Yellow
Write-Host "    copy .env.example .env                 # DATABASE_URL 비밀번호 수정" -ForegroundColor Yellow
Write-Host "    alembic stamp head"                    -ForegroundColor Yellow
Write-Host "    uvicorn app.main:app --reload"         -ForegroundColor Yellow
Write-Host ""
Write-Host "활성화가 막히면 활성화 없이 직접 호출해도 된다:" -ForegroundColor DarkGray
Write-Host "    .\.venv\Scripts\uvicorn.exe app.main:app --reload" -ForegroundColor DarkGray
Write-Host ""
