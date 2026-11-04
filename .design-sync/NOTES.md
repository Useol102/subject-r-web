# design-sync 메모 (Subject R 웹)

- 대상은 `web/` 하나. `cafe-kiosk/` 는 대상이 아니다.
- **tokens-only 동기화.** web/ 에는 export 되는 부품이 없다(App.tsx·Admin.tsx 는 /api 를 부르는 앱 전체).
  컴포넌트로 올리면 API 없이 빈 화면이 되므로 올리지 않는다. 부품 추출 리팩터링은 사용자가 고르지 않았다.
- **빈 진입 파일**: 변환기는 진입 파일에서 위로 올라가 처음 만나는 package.json 폴더(web/)를 패키지로 보고,
  `cssEntry` 는 그 폴더 안이어야 한다. web/ 코드를 고치지 않으려고 빈 진입 파일을 gitignore 된
  `web/node_modules/.ds-tokens-entry.mjs` 에 둔다. `npm ci` 를 하면 지워지므로 빌드 전에 다시 만든다:
  `echo 'export {};' > web/node_modules/.ds-tokens-entry.mjs`
- `web/src/styles.css` 를 진입 파일로 쓰면 안 된다 — esbuild 가 CSS 를 `_ds_bundle.js` 안에 넣어 버린다.
- **글꼴**: 맑은 고딕·애플 SD 산돌고딕은 OS 기본 글꼴이고 웹 글꼴 파일은 없다(LAN 전용, CDN 금지).
  `[FONT_MISSING]` 은 `runtimeFontPrefixes` 로 끈다. 사용자 지시("웹 글꼴 파일은 없다")에 따른 의도된 결정.
- **렌더 검사**: 캐시에 `chromium-1234` 가 있고 `.ds-sync` 의 playwright 는 1248 을 기대한다.
  브라우저를 새로 받지 않고 `DS_CHROMIUM_PATH="$LOCALAPPDATA/ms-playwright/chromium-1234/chrome-win64/chrome.exe"` 로 넘긴다.
  playwright 설치는 `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm i playwright` (.ds-sync 안에서).
- 셸 현재 폴더가 `ds-bundle/` 안이면 Windows 가 폴더를 잠가 빌드가 `EPERM rm` 으로 죽는다. 저장소 루트에서 돌린다.
- 재동기화 명령 (저장소 루트):
  ```sh
  DS_CHROMIUM_PATH=... node .ds-sync/resync.mjs --config .design-sync/config.json \
    --node-modules ./web/node_modules --out ./ds-bundle --remote .design-sync/.cache/remote-sync.json
  ```

## Known render warns

- 없음 (미리보기 0개, 렌더 검사 0/0).

## Re-sync risks

- `conventions.md` 의 클래스·값은 손으로 쓴 요약이다. styles.css 가 바뀌면 이름을 다시 grep 해 확인한다.
  (`--paper`·`--soft` 는 정의만 있고 쓰는 곳이 0 이다. 쓰기 시작하면 표의 설명을 고친다.)
- 굵기 숫자(600/700)와 터치 높이(45/48/60/66px)는 2026-11-04 styles.css 기준.
- `_vendor/` 의 React 는 web/node_modules 버전(18.3.1)을 따른다.
