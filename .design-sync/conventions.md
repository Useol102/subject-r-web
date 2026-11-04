# Subject R 웹 — 디자인 규칙 (월계종합사회복지관 고령자 친화형 키오스크)

이 디자인 시스템은 **색·스타일만** 있다. 내보내는 React 부품이 없어서 `window.SubjectRWeb` 는 비어 있다.
화면은 **일반 HTML 요소 + 아래 클래스 이름**으로 짓는다. 클래스를 새로 지어내지 말고 있는 것을 쓴다.
규칙의 원본은 `styles.css` → `@import "./_ds_bundle.css"` 이다. 스타일을 정하기 전에 `_ds_bundle.css` 를 직접 읽는다.

## 색 변수 (`:root`)

| 변수 | 값 | 용도 |
|---|---|---|
| `--green` | `#286449` | 주 색. `.primary` 배경, `.eyebrow`·`.text-button` 글자, 큰 검색칸 포커스 테두리 |
| `--dark` | `#174d37` | 진한 강조 글자 (`.search-hint strong`) |
| `--muted` | `#68766f` | 보조 글자 (`.muted`, `.empty`, `label small`) |
| `--line` | `#e1e6df` | 테두리·구분선 (`.panel`, `.metric`, `.sidebar`) |
| `--paper` | `#fff` | 카드 바탕. 정의만 돼 있고 기존 클래스는 `#fff` 를 직접 쓴다 |
| `--soft` | `#f1f5ee` | 옅은 바탕. 정의만 돼 있고 기존 클래스는 값을 직접 쓴다 |

본문 글자 `#243c33`, 페이지 바탕 `#f8f9f5`, 포커스 윤곽 `3px solid #dc8b29`.
이동 상태 배지: `.state-requested`(노랑) `.state-moving`(파랑) `.state-arrived`(초록) `.state-failed`(주황빨강).

## 주요 클래스

| 묶음 | 클래스 |
|---|---|
| 버튼 | `.primary`(초록 채움) `.secondary`(흰 바탕+테두리) `.text-button`(글자만) `.chip`(둥근 필터) `.back-link` |
| 제목·글 | `.page-title`(h1+p) `.eyebrow`(작은 초록 머리말) `.section-heading` `.muted` `.notice` `.inline-message` `.tag` `.empty` |
| 이용자 화면 | `.kiosk` `.kiosk-header` `.kiosk-main` `.kiosk-footer` `.welcome` `.action-grid` `.action-card` `.program-grid` `.program-card` `.place-grid` `.place-card` `.filter-row` `.button-row` `.modal` `.modal-backdrop` |
| 검색 | `.place-search` `.search-field-large` `.search-clear` `.search-hint` `.search-count` |
| 직원 화면 | `.admin-shell` `.sidebar` `.nav-item`(+`.selected`) `.admin-body` `.admin-header` `.admin-main` `.admin-page-heading` `.panel` `.panel-heading` `.metric-grid` `.metric` `.table-wrap` `.editor-form` `.full` |
| 상태 | `.status-dot` `.demo-strip` `.demo-pill` `.large-type`(글씨 크게 모드, 상위 요소에 붙임) |

## 고령층 가독성 규칙

- 글꼴은 `"Malgun Gothic", "Apple SD Gothic Neo", system-ui`. **웹 글꼴 파일은 없다**(인터넷 없는 LAN 에서 돈다).
- 기본 굵기는 600. 키오스크 본문(`.welcome p`, `.action-card p`, `.page-title p`, `.chip`, `.tag`, `.empty` 등)은 **700**.
- 맑은 고딕은 400·700 두 굵기뿐이라 **500 은 400 으로 떨어진다.** `font-synthesis:none` 이라 가짜 굵게도 없다. 굵어야 하는 글은 600 이상으로 쓴다.
- 글씨는 크게 쓴다. 키오스크 h1 26~48px, 카드 제목 22~25px, 본문 16~17px. `.large-type` 을 켜면 본문이 21px 가 된다.

## 터치·화면 폭

- 누르는 대상은 **최소 높이 45~48px**. `.primary`/`.secondary` 45px, `.chip`·`.nav-item`·입력칸 48px, 출결 버튼 60px, 큰 검색칸 66px.
- **360~1366px 폭에서 가로 스크롤이 없어야 한다.** 구간은 1150 / 900 / 800 / 600px.
- 600px 이하: 카드 격자가 한 줄로 바뀌고 로봇 그림(`.welcome-art`)을 숨긴다.
- 900px 이하: 직원 화면 왼쪽 `.sidebar` 가 위쪽 가로 메뉴로 바뀌고, 입력칸 글씨는 16px 이상이다(iOS 확대 방지).
- 디자인은 동결 상태다. 구성·색·여백·모서리·글꼴 체계를 바꾸지 말고 기존 클래스를 다시 쓴다.

## 예시

```html
<div class="kiosk">
  <main class="kiosk-main">
    <div class="page-title">
      <span class="eyebrow">프로그램 안내</span>
      <h1>오늘 열리는 프로그램</h1>
      <p>원하시는 프로그램을 눌러 주세요.</p>
    </div>
    <div class="filter-row">
      <button class="chip">전체</button>
      <button class="chip">오전</button>
    </div>
    <div class="button-row">
      <button class="primary">출석하기</button>
      <button class="secondary">처음으로</button>
    </div>
  </main>
</div>
```
