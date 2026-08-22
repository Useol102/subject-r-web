# GitHub 올리기

## 1. GitHub에서 저장소 만들기

github.com → New repository

- 이름: `subject-r-web` (자유)
- **Private 선택** ← 중요. 복지관 정보와 기관 컨택 내용이 들어갈 저장소다
- **README / .gitignore / license 는 추가하지 말 것** (이미 있어서 충돌난다)

## 2. 올리기

```powershell
cd "F:\Subject R"

git init
git branch -M main
git add -A

# 올라갈 목록 확인 — .env 와 .venv 가 없어야 정상
git status

git commit -m "1차 DB 스키마 + FastAPI 백엔드"
git remote add origin https://github.com/<아이디>/subject-r-web.git
git push -u origin main
```

`git status`에 **`.env` 나 `.venv/` 가 보이면 멈출 것.** `.gitignore`가 안 먹힌 것이다.

## 3. 팀원 초대

저장소 → Settings → Collaborators → 가은, 현민 초대

## 4. 팀원이 받아가는 법

```powershell
git clone https://github.com/<아이디>/subject-r-web.git
cd subject-r-web
```

그다음 README의 빠른 시작을 따라간다.
`.env`는 각자 만든다 (`fix-env.ps1`). DB 비밀번호가 사람마다 다르기 때문이다.

---

## 같이 작업할 때

### 스키마를 바꿀 때

```powershell
# 1. app/models.py 수정
# 2. 마이그레이션 생성
.\.venv\Scripts\alembic.exe revision --autogenerate -m "무엇을 바꿨는지"
# 3. 생성된 파일을 눈으로 확인   <- 빠뜨리지 말 것
# 4. 적용
.\.venv\Scripts\alembic.exe upgrade head
# 5. 커밋 (모델 + 마이그레이션 파일을 같이)
```

**이미 push한 마이그레이션 파일은 절대 수정하지 않는다.** 다른 사람 DB에는 이미 적용됐기
때문에, 파일을 고치면 그 사람 DB와 영원히 어긋난다. 잘못됐으면 새 리비전을 만든다.

### 남의 변경을 받았을 때

```powershell
git pull
.\.venv\Scripts\pip.exe install -r requirements.txt   # 패키지가 늘었을 수 있다
.\.venv\Scripts\alembic.exe upgrade head              # 스키마가 바뀌었을 수 있다
.\.venv\Scripts\python.exe tools\preflight.py         # 정상인지 확인
```

`alembic upgrade head`를 빼먹으면 "내 DB에선 되는데"가 시작된다.

### 브랜치

3명이면 처음엔 `main`에 직접 밀어도 된다.
동시에 같은 파일을 만지기 시작하면 그때 브랜치를 나눈다:

```powershell
git checkout -b feature/dashboard
# 작업 후
git push -u origin feature/dashboard
# GitHub에서 Pull Request
```

---

## 커밋하지 않는 것

`.gitignore`가 이미 막고 있다.

| 대상 | 이유 |
|---|---|
| `.env` | DB 비밀번호, SECRET_KEY |
| `.venv/` | 수백 MB. 각자 `setup-python-env.ps1`로 만든다 |
| `__pycache__/`, `*.pyc` | 빌드 산물 |
| `node_modules/` | 프론트 의존성 |
| `*.log` | 로그 |

### 앞으로 주의할 것

SLAM 지도 파일(`.pgm`), 학습 이미지, rosbag은 **git에 넣지 않는다.**
용량이 커서 저장소가 망가진다. 파일은 MinIO나 공유 드라이브에 두고
DB에는 경로와 sha256만 저장한다 — 이게 `data_file` 테이블을 그렇게 설계한 이유다.

만약 실수로 큰 파일을 커밋했다면 `git rm --cached <파일>` 후 `.gitignore`에 추가.
이미 push했다면 히스토리에 남으므로 팀에 알리고 같이 정리해야 한다.
