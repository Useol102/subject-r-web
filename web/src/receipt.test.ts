import { describe, expect, it } from 'vitest'
import { DEFAULT_PAPER, pageRule, paperProfile, paperWidths, readPaperWidth } from './receipt'

describe('paperProfile', () => {
  it('80mm 는 70mm 본문 · 12pt', () => {
    const p = paperProfile(80)
    expect(p.page).toBe('80mm auto')
    expect(p.content).toBe('70mm')
    expect(p.base).toBe('12pt')
  })

  it('58mm 는 본문과 글자를 함께 줄인다', () => {
    const narrow = paperProfile(58)
    const wide = paperProfile(80)
    // 폭만 줄이고 글자를 그대로 두면 한 줄에 몇 글자 안 들어간다.
    expect(parseFloat(narrow.content)).toBeLessThan(parseFloat(wide.content))
    expect(parseFloat(narrow.base)).toBeLessThan(parseFloat(wide.base))
  })

  it('본문 폭은 용지 폭에서 여백을 뺀 값보다 크지 않다', () => {
    // 이걸 넘으면 감열 프린터가 글자 끝을 잘라 먹는다.
    for (const width of paperWidths()) {
      const p = paperProfile(width)
      const usable = width - parseFloat(p.margin) * 2
      expect(parseFloat(p.content)).toBeLessThanOrEqual(usable)
    }
  })
})

describe('readPaperWidth', () => {
  it('저장된 값을 그대로 읽는다', () => {
    expect(readPaperWidth('58')).toBe(58)
    expect(readPaperWidth('80')).toBe(80)
  })

  it('값이 없으면 기본값', () => {
    expect(readPaperWidth(null)).toBe(DEFAULT_PAPER)
    expect(readPaperWidth(undefined)).toBe(DEFAULT_PAPER)
    expect(readPaperWidth('')).toBe(DEFAULT_PAPER)
  })

  it('지원하지 않는 값이면 기본값 — 화면이 깨지지 않게', () => {
    expect(readPaperWidth('112')).toBe(DEFAULT_PAPER)
    expect(readPaperWidth('그냥아무거나')).toBe(DEFAULT_PAPER)
    expect(readPaperWidth('58mm')).toBe(DEFAULT_PAPER)
  })
})

describe('pageRule', () => {
  it('폭에 맞는 @page 규칙을 만든다', () => {
    expect(pageRule(80)).toBe('@page{size:80mm auto;margin:5mm}')
    expect(pageRule(58)).toBe('@page{size:58mm auto;margin:5mm}')
  })

  it('지원하는 모든 폭에 대해 @page 로 시작하는 규칙이 나온다', () => {
    for (const width of paperWidths()) {
      expect(pageRule(width)).toMatch(/^@page\{size:\d+mm auto;margin:\d+mm\}$/)
    }
  })
})
