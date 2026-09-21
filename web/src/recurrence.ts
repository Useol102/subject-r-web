/** 반복 강좌의 회차 만들기.
 *
 * 직원이 "매주 화요일 10시, 8주" 를 누르면 회차 8개를 만들어 서버에 한 번에 보낸다.
 * 반복 규칙을 저장하지 않고 회차를 실제 행으로 만들어 두기 때문에
 * (이유는 `web_api/models.py` 의 `ProgramSession` 주석), 그 날짜 계산이 여기 있다.
 *
 * **이 파일은 DOM 을 모르는 순수 함수다.** 날짜 계산은 조용히 틀리는 종류라
 * 화면 코드에 섞어두면 수동 테스트로는 안 잡힌다. 테스트는 `recurrence.test.ts`.
 *
 * ## 시간대
 *
 * 화면의 `datetime-local` 입력은 시간대가 없는 문자열(`2026-09-21T09:30`)이다.
 * 이걸 `new Date(문자열)` 로 읽으면 **브라우저가 있는 곳의 시간대**로 해석한다.
 * 키오스크는 한국에 있지만 개발 PC 나 CI 는 아닐 수 있어서, KST 로 못박아 읽는다.
 *
 * 한국은 1988년 이후 서머타임이 없다. 그래서 "7일 뒤" 는 항상 정확히 168시간이고,
 * 밀리초 덧셈으로 계산해도 시각이 밀리지 않는다.
 */

/** 서버에 그대로 보낼 수 있는 모양 (`POST /api/admin/sessions/batch`). */
export type GeneratedSession = {
  id: string
  program_id: string
  starts_at: string
  ends_at: string
  place_id?: string
}

export type RepeatInput = {
  programId: string
  /** 첫 회차 시작. `datetime-local` 값 그대로. KST 로 읽는다 */
  startsAtLocal: string
  /** 첫 회차 종료. 시작보다 뒤여야 한다 */
  endsAtLocal: string
  /** 만들 회차 수 */
  count: number
  /** 몇 주 간격인가. 1 = 매주, 2 = 격주 */
  everyWeeks?: number
  /** 회차별 장소. 비우면 서버가 프로그램 기본 장소를 쓴다 */
  placeId?: string
  /** 이미 있는 회차 ID. 번호가 겹치지 않게 피한다 */
  existingIds?: readonly string[]
}

const ID_MAX = 64
const COUNT_MAX = 400 // 서버 SessionBatchIn 의 상한과 같다
const CODE = /^[a-zA-Z0-9_-]{1,64}$/
const LOCAL = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/

/** `datetime-local` 문자열을 **KST 로 읽어** Date 로 만든다.
 *
 * `new Date('2026-09-21T09:30')` 은 브라우저 표준시로 읽어 한국 밖에서 틀린다.
 * KST = UTC+9 이므로 UTC 시각은 9시간을 뺀 값이다. `Date.UTC` 가 음수 시간을
 * 전날로 알아서 넘겨준다 (00:30 KST → 전날 15:30 UTC).
 */
export function kstLocalToDate(local: string): Date {
  const found = LOCAL.exec(local.trim())
  if (!found) throw new Error('시각 형식이 올바르지 않습니다. (예: 2026-09-21T09:30)')
  const [, year, month, day, hour, minute, second] = found
  return new Date(Date.UTC(+year, +month - 1, +day, +hour - 9, +minute, +(second || 0)))
}

/** 저장 형식과 같은 24자 UTC 문자열. `models.iso_z()` 와 형식이 같다. */
export function isoZ(moment: Date): string {
  return moment.toISOString()
}

/** `프로그램ID-번호`. 64자를 넘지 않게 앞을 자른다. */
export function sessionId(programId: string, number: number): string {
  const suffix = `-${number}`
  return programId.slice(0, ID_MAX - suffix.length) + suffix
}

/** 이미 쓰인 번호를 건너뛰며 ID 를 count 개 고른다. */
function pickIds(programId: string, count: number, existing: ReadonlySet<string>): string[] {
  const ids: string[] = []
  for (let number = 1; ids.length < count; number++) {
    // 프로그램 하나에 회차가 이만큼 쌓일 일은 없다. 무한 루프만 막는다.
    if (number > COUNT_MAX * 10) throw new Error('회차 ID를 더 만들 수 없습니다.')
    const id = sessionId(programId, number)
    if (!existing.has(id)) ids.push(id)
  }
  return ids
}

/** 반복 회차를 만든다. 서버에 보내기 전에 화면에서 미리 보여줄 수도 있다. */
export function generateSessions(input: RepeatInput): GeneratedSession[] {
  const { programId, startsAtLocal, endsAtLocal, count, everyWeeks = 1, placeId, existingIds = [] } = input

  if (!CODE.test(programId)) throw new Error('프로그램 ID가 올바르지 않습니다.')
  if (!Number.isInteger(count) || count < 1 || count > COUNT_MAX) {
    throw new Error(`회차 수는 1~${COUNT_MAX} 사이여야 합니다.`)
  }
  if (!Number.isInteger(everyWeeks) || everyWeeks < 1 || everyWeeks > 52) {
    throw new Error('반복 간격은 1~52주 사이여야 합니다.')
  }

  const first = kstLocalToDate(startsAtLocal)
  const firstEnd = kstLocalToDate(endsAtLocal)
  const duration = firstEnd.getTime() - first.getTime()
  if (duration <= 0) throw new Error('종료 시각은 시작 시각 이후여야 합니다.')

  const ids = pickIds(programId, count, new Set(existingIds))
  // 한국은 서머타임이 없어 "n주 뒤" 가 항상 정확히 n*7*24 시간이다.
  const week = 7 * 24 * 60 * 60 * 1000
  return ids.map((id, index) => {
    const starts = new Date(first.getTime() + index * everyWeeks * week)
    return {
      id,
      program_id: programId,
      starts_at: isoZ(starts),
      ends_at: isoZ(new Date(starts.getTime() + duration)),
      ...(placeId ? { place_id: placeId } : {}),
    }
  })
}

/** 미리보기 문구용. "9월 21일(월) 09:30" 같은 한국 표기. */
export function describeKst(isoString: string): string {
  return new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul', month: 'long', day: 'numeric', weekday: 'short',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(new Date(isoString))
}
