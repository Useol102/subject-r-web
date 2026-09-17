/** 바코드 스캐너 입력 판별.
 *
 * 복지관에서 쓰는 USB 바코드 스캐너는 대부분 **키보드 웨지(HID)** 방식이다.
 * 화면에는 아무 표시도 없이, 읽은 값을 키보드처럼 아주 빠르게 타이핑하고
 * 마지막에 Enter 를 친다. 그래서 "사람이 친 것"과 "스캐너가 쏜 것"을
 * 구분하는 기준은 **글자 사이의 시간 간격** 하나뿐이다.
 *
 * 사람은 아무리 빨라도 글자당 80ms 안팎이고, 어르신은 훨씬 느리다.
 * 스캐너는 보통 5~20ms 다. 그래서 기본 경계값을 50ms 로 잡았다.
 *
 * 이 파일은 DOM 을 모른다. 키 이름과 시각만 받는 순수 함수라서
 * 테스트로 검증할 수 있다 (`web/src/scanner.test.ts`).
 */

export type ScanOptions = {
  /** 이 간격(ms)보다 빠르게 이어져야 스캐너로 본다. */
  maxKeyIntervalMs?: number
  /** 이 길이 미만이면 오타로 보고 버린다. */
  minLength?: number
  /** 이 길이를 넘으면 버퍼를 버린다 (키보드를 누른 채 방치한 경우). */
  maxLength?: number
}

export type ScanBuffer = {
  /** 키 하나를 넣는다. 스캔이 완성되면 그 값을, 아니면 null 을 준다. */
  push(key: string, atMs: number): string | null
  /** 지금까지 쌓인 글자 수. 화면에 "읽는 중" 표시를 할 때 쓴다. */
  size(): number
  reset(): void
}

const DEFAULTS: Required<ScanOptions> = {
  maxKeyIntervalMs: 50,
  minLength: 4,
  maxLength: 64,
}

/** 한 글자짜리 인쇄 가능한 키인지. (Shift, Control, F1 ... 은 제외) */
export function isPrintableKey(key: string): boolean {
  return key.length === 1 && key !== ' '
}

export function createScanBuffer(options: ScanOptions = {}): ScanBuffer {
  const opts = { ...DEFAULTS, ...options }
  let chars: string[] = []
  let lastAt = 0
  /** 사람이 천천히 친 흔적이 한 번이라도 있으면 이 스캔은 버린다. */
  let tooSlow = false

  function reset() {
    chars = []
    lastAt = 0
    tooSlow = false
  }

  return {
    reset,
    size: () => chars.length,
    push(key, atMs) {
      if (key === 'Enter') {
        const code = chars.join('')
        const ok = !tooSlow && code.length >= opts.minLength
        reset()
        return ok ? code : null
      }
      if (!isPrintableKey(key)) return null

      const gap = lastAt === 0 ? 0 : atMs - lastAt
      // 간격이 벌어졌으면 앞의 입력은 남의 것이다. 여기서부터 새로 센다.
      if (lastAt !== 0 && gap > opts.maxKeyIntervalMs) {
        chars = []
        tooSlow = false
      }
      lastAt = atMs
      chars.push(key)
      if (chars.length > opts.maxLength) reset()
      return null
    },
  }
}

/** 오늘 일정 중에서 출석 화면이 기본으로 골라줄 프로그램 하나.
 *
 * 어르신에게 목록을 먼저 고르게 하면 거기서 막힌다. 지금 하는 것이 있으면
 * 그걸, 없으면 곧 시작하는 것을 미리 골라둔다. 화면에서 바꿀 수는 있다.
 */
export function pickDefaultProgram<T extends { starts_at: string; ends_at: string }>(
  todays: T[],
  now: Date,
  graceMinutes = 30,
): T | null {
  const at = now.getTime()
  const grace = graceMinutes * 60 * 1000
  const parsed = todays
    .map(p => ({ p, from: Date.parse(p.starts_at), to: Date.parse(p.ends_at) }))
    .filter(x => Number.isFinite(x.from) && Number.isFinite(x.to))
    .sort((a, b) => a.from - b.from)

  // 1. 진행 중 (시작 30분 전부터 끝날 때까지 — 출석은 보통 시작 전에 한다)
  const ongoing = parsed.find(x => at >= x.from - grace && at <= x.to)
  if (ongoing) return ongoing.p

  // 2. 오늘 남은 것 중 가장 빠른 것
  const next = parsed.find(x => x.from > at)
  if (next) return next.p

  // 3. 오늘 일정이 전부 끝났으면 고르지 않는다
  return null
}
