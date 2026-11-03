import { describe, expect, it } from 'vitest'
import {
  addToCart, cartTotals, changeQty, defaultOptions, formatOrderNumber, formatWon, lineKey,
  MAX_QTY, needsOptionSheet, nextOrderNumber, optionLabel, removeLine, unitPrice,
} from './cart'
import { MENU, LARGE_EXTRA } from './menu'

const americano = MENU.find((m) => m.id === 'americano')!
const cookie = MENU.find((m) => m.id === 'cookie')!
const coldBrew = MENU.find((m) => m.id === 'cold-brew')!
const espresso = MENU.find((m) => m.id === 'espresso')!

describe('가격', () => {
  it('기본 사이즈는 메뉴 가격 그대로', () => {
    expect(unitPrice(americano, { temperature: 'HOT', size: 'R' })).toBe(4000)
  })
  it('라지는 추가 금액이 붙는다', () => {
    expect(unitPrice(americano, { temperature: 'ICE', size: 'L' })).toBe(4000 + LARGE_EXTRA)
  })
  it('원화 표기', () => {
    expect(formatWon(4500)).toBe('4,500원')
    expect(formatWon(0)).toBe('0원')
    expect(formatWon(1234567)).toBe('1,234,567원')
  })
})

describe('담기', () => {
  it('새 메뉴는 줄이 추가된다', () => {
    const lines = addToCart([], americano, { temperature: 'HOT', size: 'R' })
    expect(lines).toHaveLength(1)
    expect(lines[0].qty).toBe(1)
    expect(lines[0].key).toBe(lineKey('americano', { temperature: 'HOT', size: 'R' }))
  })
  it('같은 메뉴·옵션은 수량만 더한다', () => {
    let lines = addToCart([], americano, { temperature: 'HOT', size: 'R' })
    lines = addToCart(lines, americano, { temperature: 'HOT', size: 'R' }, 2)
    expect(lines).toHaveLength(1)
    expect(lines[0].qty).toBe(3)
  })
  it('옵션이 다르면 다른 줄', () => {
    let lines = addToCart([], americano, { temperature: 'HOT', size: 'R' })
    lines = addToCart(lines, americano, { temperature: 'ICE', size: 'R' })
    expect(lines).toHaveLength(2)
  })
  it('최대 수량을 넘지 않는다', () => {
    const lines = addToCart([], cookie, {}, 500)
    expect(lines[0].qty).toBe(MAX_QTY)
  })
})

describe('수량 변경', () => {
  const base = addToCart(addToCart([], americano, { temperature: 'HOT', size: 'R' }, 2), cookie, {})
  const key = base[0].key
  it('+1', () => {
    expect(changeQty(base, key, 1)[0].qty).toBe(3)
  })
  it('-1', () => {
    expect(changeQty(base, key, -1)[0].qty).toBe(1)
  })
  it('0 이 되면 줄이 사라진다', () => {
    const lines = changeQty(base, key, -2)
    expect(lines).toHaveLength(1)
    expect(lines[0].item.id).toBe('cookie')
  })
  it('없는 키는 무시', () => {
    expect(changeQty(base, 'nope', 1)).toEqual(base)
  })
  it('삭제', () => {
    expect(removeLine(base, key)).toHaveLength(1)
  })
})

describe('합계', () => {
  it('빈 장바구니', () => {
    expect(cartTotals([])).toEqual({ count: 0, total: 0 })
  })
  it('수량·옵션 반영', () => {
    let lines = addToCart([], americano, { temperature: 'ICE', size: 'L' }, 2) // 4500 × 2
    lines = addToCart(lines, cookie, {}, 3) // 2800 × 3
    expect(cartTotals(lines)).toEqual({ count: 5, total: 9000 + 8400 })
  })
})

describe('옵션', () => {
  it('기본 옵션은 HOT · 기본, ICE 전용이면 ICE', () => {
    expect(defaultOptions(americano)).toEqual({ temperature: 'HOT', size: 'R' })
    expect(defaultOptions(coldBrew)).toEqual({ temperature: 'ICE', size: 'R' })
    expect(defaultOptions(cookie)).toEqual({})
  })
  it('선택할 게 있는 메뉴만 옵션 창을 띄운다', () => {
    expect(needsOptionSheet(americano)).toBe(true)
    expect(needsOptionSheet(coldBrew)).toBe(true) // 사이즈는 고른다
    expect(needsOptionSheet(espresso)).toBe(false) // HOT 전용, 사이즈 없음
    expect(needsOptionSheet(cookie)).toBe(false)
  })
  it('옵션 문구', () => {
    expect(optionLabel({ temperature: 'ICE', size: 'L' })).toBe('ICE · 라지')
    expect(optionLabel({ temperature: 'HOT', size: 'R' })).toBe('HOT · 기본')
    expect(optionLabel({})).toBe('')
  })
})

describe('주문번호', () => {
  it('1 씩 오르고 999 다음은 001', () => {
    expect(nextOrderNumber(0)).toBe(1)
    expect(nextOrderNumber(41)).toBe(42)
    expect(nextOrderNumber(999)).toBe(1)
  })
  it('3자리 표기', () => {
    expect(formatOrderNumber(7)).toBe('007')
    expect(formatOrderNumber(123)).toBe('123')
  })
})
