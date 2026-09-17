/** 영수증 용지 규격.
 *
 * 복지관에서 쓸 영수증 프린터는 **감열식(thermal)** 이고, 시중 기종은 용지 폭이
 * 사실상 두 가지뿐이다 — 카운터용 80mm, 휴대·소형 단말용 58mm.
 * 기종이 확정되기 전이라 둘 다 지원하고, 화면에서 전환한다.
 *
 * 폭마다 바뀌는 값이 세 개다:
 *   - 용지 폭      `@page size`. 브라우저가 미리보기 크기를 잡는 데 쓴다.
 *   - 인쇄 가능 폭  감열 프린터는 용지 양끝 몇 mm 를 못 찍는다. 그만큼 빼야 글자가 안 잘린다.
 *   - 기본 글자 크기 58mm 에 12pt 를 쓰면 한 줄에 열 글자도 안 들어간다.
 *
 * 이 파일은 DOM 을 모르는 순수 함수다. 테스트는 `receipt.test.ts`.
 */

export type PaperWidth = 58 | 80

export type PaperProfile = {
  width: PaperWidth
  /** `@page size` 에 넣을 값 */
  page: string
  /** 여백. 감열 프린터의 못 찍는 가장자리를 감안한 값 */
  margin: string
  /** 본문이 차지할 최대 폭 */
  content: string
  /** 기본 글자 크기 */
  base: string
}

/** 기종 미확정 상태의 기본값. 카운터용 영수증 프린터는 대부분 80mm 다. */
export const DEFAULT_PAPER: PaperWidth = 80

const PROFILES: Record<PaperWidth, PaperProfile> = {
  80: { width: 80, page: '80mm auto', margin: '5mm', content: '70mm', base: '12pt' },
  58: { width: 58, page: '58mm auto', margin: '5mm', content: '48mm', base: '10pt' },
}

export function paperProfile(width: PaperWidth): PaperProfile {
  return PROFILES[width]
}

/** 지원하는 폭 목록. 화면의 선택 버튼이 이걸 그대로 쓴다. */
export function paperWidths(): PaperWidth[] {
  return [80, 58]
}

/** 저장된 값을 읽는다. 값이 없거나 이상하면 기본값으로 돌린다.
 *
 * localStorage 가 비어 있거나(첫 사용), 누가 손으로 고쳐놨거나,
 * 나중에 지원 폭이 바뀌어 옛 값이 남아 있어도 화면이 깨지면 안 된다.
 */
export function readPaperWidth(raw: string | null | undefined): PaperWidth {
  const value = Number(raw)
  return paperWidths().includes(value as PaperWidth) ? (value as PaperWidth) : DEFAULT_PAPER
}

/** 인쇄용 `@page` 규칙 문자열.
 *
 * `@page` 는 문서 전체에 걸리는 규칙이라 CSS 변수(`var()`)를 못 쓴다.
 * 그래서 폭이 바뀔 때마다 이 문자열을 만들어 `<style>` 로 갈아끼운다.
 */
export function pageRule(width: PaperWidth): string {
  const profile = paperProfile(width)
  return `@page{size:${profile.page};margin:${profile.margin}}`
}
