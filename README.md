# Subject R 웹 빠른 시작

자세한 인수인계는 [`docs/WEB-START.md`](docs/WEB-START.md)를 읽는다.

```powershell
.\.venv\Scripts\python.exe -m alembic -c web-alembic.ini upgrade head
.\.venv\Scripts\python.exe -m uvicorn web_api.main:app --host 127.0.0.1 --port 8000
```

별도 터미널:

```powershell
Set-Location web
npm install
npm run dev
```

이용자 화면은 `http://127.0.0.1:5173/`, 직원 화면은 `http://127.0.0.1:5173/admin`이다. 기본은 예시 데이터 모드이며, 직원 화면에서 데이터를 불러온 뒤 흐름을 확인한다.
