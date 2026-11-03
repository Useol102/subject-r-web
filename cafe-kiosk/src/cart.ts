// 장바구니·금액 계산. DOM 을 모르는 순수 함수만 둔다. cart.test.ts 로 검증한다.
import { LARGE_EXTRA, type MenuItem } from './menu'

export type Temperature = 'HOT' | 'ICE'
export type Size = 'R' | 'L'

export interface LineOptions {
  temperature?: Temperature
  size?: Size
}

export interface CartLine extends LineOptions {
  /** 메뉴 + 옵션 조합을 식별하는 키. 같은 키는 한 줄로 합쳐진다 */
  key: string
  item: MenuItem
  qty: number
}

/** 한 줄 최대 수량 */
export const MAX_QTY = 99

export function lineKey(itemId: string, opts: LineOptions): string {
  return [itemId, opts.temperature ?? '-', opts.size ?? '-'].join('|')
}

/** 옵션을 반영한 1개 가격 */
export function unitPrice(item: MenuItem, opts: LineOptions): number {
  return item.price + (opts.size === 'L' ? LARGE_EXTRA : 0)
}

export function lineTotal(line: CartLine): number {
  return unitPrice(line.item, line) * line.qty
}

/** 담기. 같은 메뉴·옵션이면 수량만 더한다 */
export function addToCart(lines: CartLine[], item: MenuItem, opts: LineOptions, qty = 1): CartLine[] {
  const key = lineKey(item.id, opts)
  const found = lines.find((l) => l.key === key)
  if (found) {
    return lines.map((l) => (l.key === key ? { ...l, qty: Math.min(MAX_QTY, l.qty + qty) } : l))
  }
  return [...lines, { key, item, temperature: opts.temperature, size: opts.size, qty: Math.min(MAX_QTY, Math.max(1, qty)) }]
}

/** 수량 변경. 0 이하가 되면 줄을 지운다 */
export function changeQty(lines: CartLine[], key: string, delta: number): CartLine[] {
  return lines
    .map((l) => (l.key === key ? { ...l, qty: Math.min(MAX_QTY, l.qty + delta) } : l))
    .filter((l) => l.qty > 0)
}

export function removeLine(lines: CartLine[], key: string): CartLine[] {
  return lines.filter((l) => l.key !== key)
}

export interface CartTotals {
  /** 잔·개 수 합계 */
  count: number
  /** 결제 금액 */
  total: number
}

export function cartTotals(lines: CartLine[]): CartTotals {
  return lines.reduce(
    (acc, l) => ({ count: acc.count + l.qty, total: acc.total + lineTotal(l) }),
    { count: 0, total: 0 },
  )
}

/** 4500 → "4,500원" */
export function formatWon(n: number): string {
  return `${n.toLocaleString('ko-KR')}원`
}

/** 옵션 표시 문구. 없으면 빈 문자열 */
export function optionLabel(opts: LineOptions): string {
  const parts: string[] = []
  if (opts.temperature) parts.push(opts.temperature)
  if (opts.size) parts.push(opts.size === 'L' ? '크게' : '기본')
  return parts.join(' · ')
}

/** 메뉴에 맞는 기본 옵션. 선택 가능한 것만 채운다 */
export function defaultOptions(item: MenuItem): LineOptions {
  const opts: LineOptions = {}
  if (item.hasTemperature) opts.temperature = item.iceOnly ? 'ICE' : 'HOT'
  if (item.hasSize) opts.size = 'R'
  return opts
}

/** 옵션 선택이 필요한 메뉴인지 (아니면 바로 담는다) */
export function needsOptionSheet(item: MenuItem): boolean {
  const tempChoice = item.hasTemperature && !item.iceOnly && !item.hotOnly
  return tempChoice || item.hasSize
}

/** 주문번호. 하루 안에서 1 씩 올라가고 3자리로 맞춘다 (001 → 002). 999 다음은 001 */
export function nextOrderNumber(prev: number): number {
  return prev >= 999 ? 1 : prev + 1
}

export function formatOrderNumber(n: number): string {
  return String(n).padStart(3, '0')
}
