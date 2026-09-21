import { describe, expect, it } from 'vitest'
import { generateSessions, isoZ, kstLocalToDate, sessionId } from './recurrence'

const base = { programId: 'demo-stretch', startsAtLocal: '2026-09-21T09:30', endsAtLocal: '2026-09-21T10:30' }

describe('kstLocalToDate', () => {
  it('시간대 없는 입력을 KST 로 읽는다', () => {
    // 09:30 KST == 00:30 UTC
    expect(isoZ(kstLocalToDate('2026-09-21T09:30'))).toBe('2026-09-21T00:30:00.000Z')
  })

  it('한국 새벽은 UTC 로 전날이다', () => {
    // 이걸 브라우저 표준시로 읽으면 날짜가 하루 밀린다
    expect(isoZ(kstLocalToDate('2026-09-21T00:30'))).toBe('2026-09-20T15:30:00.000Z')
  })

  it('초가 붙어 있어도 읽는다', () => {
    expect(isoZ(kstLocalToDate('2026-09-21T09:30:45'))).toBe('2026-09-21T00:30:45.000Z')
  })

  it('형식이 틀리면 거부한다', () => {
    expect(() => kstLocalToDate('2026/09/21 09:30')).toThrow()
    expect(() => kstLocalToDate('')).toThrow()
  })
})

describe('sessionId', () => {
  it('프로그램 ID 에 번호를 붙인다', () => {
    expect(sessionId('demo-stretch', 1)).toBe('demo-stretch-1')
    expect(sessionId('demo-stretch', 12)).toBe('demo-stretch-12')
  })

  it('64자를 넘지 않게 앞을 자른다', () => {
    // 서버의 Code 패턴이 64자까지다. 넘으면 저장이 422 로 막힌다.
    const long = 'p'.repeat(64)
    expect(sessionId(long, 7)).toHaveLength(64)
    expect(sessionId(long, 7).endsWith('-7')).toBe(true)
  })
})

describe('generateSessions', () => {
  it('매주 같은 시각으로 회차를 만든다', () => {
    const rows = generateSessions({ ...base, count: 3 })
    expect(rows.map(r => r.starts_at)).toEqual([
      '2026-09-21T00:30:00.000Z',
      '2026-09-28T00:30:00.000Z',
      '2026-10-05T00:30:00.000Z',
    ])
    expect(rows.map(r => r.id)).toEqual(['demo-stretch-1', 'demo-stretch-2', 'demo-stretch-3'])
    expect(rows.every(r => r.program_id === 'demo-stretch')).toBe(true)
  })

  it('달과 해를 넘겨도 요일이 유지된다', () => {
    const rows = generateSessions({ ...base, startsAtLocal: '2026-12-29T09:30',
      endsAtLocal: '2026-12-29T10:30', count: 3 })
    const weekdays = rows.map(r => new Intl.DateTimeFormat('ko-KR',
      { timeZone: 'Asia/Seoul', weekday: 'short' }).format(new Date(r.starts_at)))
    expect(new Set(weekdays).size).toBe(1)
    expect(rows[2].starts_at.slice(0, 10)).toBe('2027-01-12')
  })

  it('수업 길이를 회차마다 그대로 유지한다', () => {
    const rows = generateSessions({ ...base, endsAtLocal: '2026-09-21T11:00', count: 4 })
    for (const row of rows) {
      const minutes = (Date.parse(row.ends_at) - Date.parse(row.starts_at)) / 60000
      expect(minutes).toBe(90)
    }
  })

  it('자정을 넘기는 수업도 길이를 유지한다', () => {
    const rows = generateSessions({ programId: 'night', startsAtLocal: '2026-09-21T23:30',
      endsAtLocal: '2026-09-22T00:30', count: 2 })
    expect(rows[0].starts_at).toBe('2026-09-21T14:30:00.000Z')
    expect(rows[0].ends_at).toBe('2026-09-21T15:30:00.000Z')
    expect(Date.parse(rows[1].starts_at) - Date.parse(rows[0].starts_at)).toBe(7 * 24 * 3600 * 1000)
  })

  it('격주도 만든다', () => {
    const rows = generateSessions({ ...base, count: 3, everyWeeks: 2 })
    expect(rows.map(r => r.starts_at.slice(0, 10))).toEqual(['2026-09-21', '2026-10-05', '2026-10-19'])
  })

  it('이미 있는 회차 ID 는 건너뛴다', () => {
    // 같은 ID 로 저장하면 기존 회차를 덮어쓴다. 직원이 의도한 게 아니다.
    const rows = generateSessions({ ...base, count: 2, existingIds: ['demo-stretch-1', 'demo-stretch-3'] })
    expect(rows.map(r => r.id)).toEqual(['demo-stretch-2', 'demo-stretch-4'])
  })

  it('장소를 주면 회차마다 붙이고, 안 주면 비워 둔다', () => {
    expect(generateSessions({ ...base, count: 1, placeId: 'demo-hall' })[0].place_id).toBe('demo-hall')
    expect(generateSessions({ ...base, count: 1 })[0]).not.toHaveProperty('place_id')
  })

  it('저장 형식과 같은 24자 UTC 문자열을 만든다', () => {
    // models.iso_z 와 같은 형식이라야 문자열 정렬이 곧 시간순이다
    const rows = generateSessions({ ...base, count: 2 })
    for (const row of rows) {
      expect(row.starts_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)
      expect(row.starts_at).toHaveLength(24)
    }
  })

  it('종료가 시작보다 앞서면 거부한다', () => {
    expect(() => generateSessions({ ...base, endsAtLocal: '2026-09-21T09:30', count: 1 })).toThrow()
    expect(() => generateSessions({ ...base, endsAtLocal: '2026-09-21T09:00', count: 1 })).toThrow()
  })

  it('회차 수가 범위를 벗어나면 거부한다', () => {
    expect(() => generateSessions({ ...base, count: 0 })).toThrow()
    expect(() => generateSessions({ ...base, count: 401 })).toThrow()
    expect(() => generateSessions({ ...base, count: 2.5 })).toThrow()
  })

  it('프로그램 ID 가 서버 규칙에 맞지 않으면 거부한다', () => {
    expect(() => generateSessions({ ...base, programId: '한글아이디', count: 1 })).toThrow()
    expect(() => generateSessions({ ...base, programId: '', count: 1 })).toThrow()
  })

  it('반복 간격이 범위를 벗어나면 거부한다', () => {
    expect(() => generateSessions({ ...base, count: 1, everyWeeks: 0 })).toThrow()
    expect(() => generateSessions({ ...base, count: 1, everyWeeks: 53 })).toThrow()
  })
})
