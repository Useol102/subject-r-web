/** 한글 장소 검색 (초성 검색 포함).
 *
 * 어르신은 키오스크 화면 키보드로 받침까지 정확히 치기 어렵다.
 * 그래서 다음을 모두 같은 장소로 찾아준다.
 *
 *   - 이름 일부:        "강당"      → "어울림 강당"
 *   - 띄어쓰기 무시:    "어울림강당" → "어울림 강당"
 *   - 초성만:           "ㅁㄹㅊㄹㅅ" → "물리치료실"
 *   - 초성과 글자 섞기: "물ㄹㅊ"     → "물리치료실"
 *   - 치는 중인 글자:   "건가"       → "건강교실" (마지막 글자 받침을 아직 안 쳤을 때)
 *
 * 이 파일은 DOM 을 모르는 순수 함수다. 테스트는 `hangulSearch.test.ts`.
 */

const SYLLABLE_START = 0xac00
const SYLLABLE_END = 0xd7a3
const JUNG_COUNT = 21
const JONG_COUNT = 28

/** 음절 초성 순서 (유니코드 표준 순서). 호환 자모로 적어 사용자가 치는 글자와 바로 비교한다. */
const CHOSEONG = ['ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ']
const CHOSEONG_SET = new Set(CHOSEONG)

function isSyllable(ch: string): boolean {
  const code = ch.charCodeAt(0)
  return code >= SYLLABLE_START && code <= SYLLABLE_END
}

/** 완성형 음절의 초성. 음절이 아니면 null. */
export function choseongOf(ch: string): string | null {
  if (!isSyllable(ch)) return null
  return CHOSEONG[Math.floor((ch.charCodeAt(0) - SYLLABLE_START) / (JUNG_COUNT * JONG_COUNT))]
}

/** 비교용 정규화: 앞뒤·중간 공백 제거, 영문 소문자, 자모 조합형(NFD)을 완성형으로. */
export function normalize(text: string): string {
  return text.normalize('NFC').replace(/\s+/g, '').toLowerCase()
}

/** 질의 글자 하나가 대상 글자 하나와 맞는지. `isLast` 는 질의의 마지막 글자인지. */
function charMatches(q: string, t: string, isLast: boolean): boolean {
  if (q === t) return true
  // 초성만 친 경우: ㅁ ↔ 물
  if (CHOSEONG_SET.has(q)) return choseongOf(t) === q
  // 마지막 글자를 치는 중인 경우: "가" ↔ "강" (받침 없는 음절이 초성·중성까지 같으면)
  if (isLast && isSyllable(q) && isSyllable(t)) {
    const qi = q.charCodeAt(0) - SYLLABLE_START
    const ti = t.charCodeAt(0) - SYLLABLE_START
    return qi % JONG_COUNT === 0 && Math.floor(qi / JONG_COUNT) === Math.floor(ti / JONG_COUNT)
  }
  return false
}

/** `target` 안에서 `query` 가 시작하는 가장 앞 위치. 없으면 -1. 둘 다 정규화된 값이어야 한다. */
function indexOfHangul(target: string, query: string): number {
  const t = Array.from(target)
  const q = Array.from(query)
  for (let start = 0; start + q.length <= t.length; start++) {
    let ok = true
    for (let i = 0; i < q.length; i++) {
      if (!charMatches(q[i], t[start + i], i === q.length - 1)) { ok = false; break }
    }
    if (ok) return start
  }
  return -1
}

/** 이름이 질의와 얼마나 잘 맞는지. 클수록 앞에 보인다. 안 맞으면 0.
 *
 * 순서: 이름이 그대로 시작 > 이름 중간에 포함 > 구분(카테고리)에만 포함
 */
export function scoreText(name: string, query: string, category = ''): number {
  const q = normalize(query)
  if (!q) return 1
  const at = indexOfHangul(normalize(name), q)
  if (at === 0) return 3
  if (at > 0) return 2
  if (category && indexOfHangul(normalize(category), q) >= 0) return 1
  return 0
}

/** 질의에 맞는 항목만 점수순으로. 점수가 같으면 원래 순서를 지킨다. 질의가 비면 원래 목록 그대로. */
export function searchByName<T>(
  items: T[],
  query: string,
  pick: (item: T) => { name: string; category?: string },
): T[] {
  if (!normalize(query)) return items
  return items
    .map((item, index) => {
      const { name, category } = pick(item)
      return { item, index, score: scoreText(name, query, category) }
    })
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map(x => x.item)
}
