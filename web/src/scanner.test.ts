import { describe, expect, it } from 'vitest'
import { createScanBuffer, isPrintableKey, pickDefaultProgram } from './scanner'

/** 키 목록을 일정한 간격으로 밀어넣는다. 마지막에 넘어온 값을 준다. */
function type(buffer: ReturnType<typeof createScanBuffer>, keys: string[], gapMs: number, startAt = 1000) {
  let result: string | null = null
  keys.forEach((key, i) => {
    result = buffer.push(key, startAt + i * gapMs)
  })
  return result
}

describe('createScanBuffer', () => {
  it('스캐너 속도(10ms)로 들어온 값은 Enter 에서 코드로 나온다', () => {
    const buffer = createScanBuffer()
    expect(type(buffer, ['8', '8', '0', '1', '2', '3', 'Enter'], 10)).toBe('880123')
  })

  it('사람이 친 속도(200ms)는 스캔으로 보지 않는다', () => {
    const buffer = createScanBuffer()
    expect(type(buffer, ['8', '8', '0', '1', '2', '3', 'Enter'], 200)).toBeNull()
  })

  it('중간에 한 번이라도 느려지면 그 앞은 버리고 뒤만 센다', () => {
    const buffer = createScanBuffer()
    // 느린 'a','b' 뒤에 스캐너가 쏜 값이 붙은 경우
    buffer.push('a', 0)
    buffer.push('b', 500)
    expect(type(buffer, ['9', '9', '8', '8', 'Enter'], 8, 1000)).toBe('9988')
  })

  it('너무 짧으면 오타로 보고 버린다', () => {
    const buffer = createScanBuffer()
    expect(type(buffer, ['1', '2', 'Enter'], 10)).toBeNull()
  })

  it('Enter 를 받으면 버퍼가 비워져서 다음 스캔에 섞이지 않는다', () => {
    const buffer = createScanBuffer()
    type(buffer, ['1', '1', '1', '1', 'Enter'], 10)
    expect(buffer.size()).toBe(0)
    expect(type(buffer, ['2', '2', '2', '2', 'Enter'], 10, 5000)).toBe('2222')
  })

  it('Shift 같은 보조키는 무시한다', () => {
    const buffer = createScanBuffer()
    const keys = ['Shift', 'A', 'Shift', 'B', 'C', 'D', 'Enter']
    expect(type(buffer, keys, 10)).toBe('ABCD')
  })

  it('최대 길이를 넘으면 버린다', () => {
    const buffer = createScanBuffer({ maxLength: 8 })
    expect(type(buffer, [...'123456789'.split(''), 'Enter'], 10)).toBeNull()
  })
})

describe('isPrintableKey', () => {
  it('한 글자만 인쇄 가능한 키로 본다', () => {
    expect(isPrintableKey('A')).toBe(true)
    expect(isPrintableKey('7')).toBe(true)
    expect(isPrintableKey('Shift')).toBe(false)
    expect(isPrintableKey('Enter')).toBe(false)
    expect(isPrintableKey(' ')).toBe(false)
  })
})

describe('pickDefaultProgram', () => {
  const programs = [
    { id: 'a', starts_at: '2026-09-17T00:00:00Z', ends_at: '2026-09-17T01:00:00Z' },
    { id: 'b', starts_at: '2026-09-17T05:00:00Z', ends_at: '2026-09-17T06:00:00Z' },
  ]

  it('진행 중인 프로그램을 고른다', () => {
    const now = new Date('2026-09-17T05:30:00Z')
    expect(pickDefaultProgram(programs, now)?.id).toBe('b')
  })

  it('시작 30분 전이면 미리 고른다 (출석은 시작 전에 한다)', () => {
    const now = new Date('2026-09-17T04:40:00Z')
    expect(pickDefaultProgram(programs, now)?.id).toBe('b')
  })

  it('아직 이르면 다음 프로그램을 고른다', () => {
    const now = new Date('2026-09-16T23:00:00Z')
    expect(pickDefaultProgram(programs, now)?.id).toBe('a')
  })

  it('오늘 일정이 다 끝났으면 고르지 않는다', () => {
    const now = new Date('2026-09-17T09:00:00Z')
    expect(pickDefaultProgram(programs, now)).toBeNull()
  })

  it('목록이 비어도 터지지 않는다', () => {
    expect(pickDefaultProgram([], new Date())).toBeNull()
  })
})
