import { describe, expect, it } from 'vitest'
import { FLOW_STEPS, pageTitle, stepStates } from './flow'

describe('진행 단계', () => {
  it('시작 화면에서는 모두 남은 단계', () => {
    expect(stepStates('start')).toEqual(['todo', 'todo', 'todo', 'todo'])
  })
  it('주문 확인: 메뉴는 지남, 확인은 지금', () => {
    expect(stepStates('confirm')).toEqual(['done', 'current', 'todo', 'todo'])
  })
  it('주문 완료: 앞 단계는 모두 지남', () => {
    expect(stepStates('done')).toEqual(['done', 'done', 'done', 'current'])
  })
  it('단계는 4개, 순서는 메뉴 → 확인 → 결제 → 완료', () => {
    expect(FLOW_STEPS.map((s) => s.id)).toEqual(['menu', 'confirm', 'pay', 'done'])
  })
  it('탭 제목', () => {
    expect(pageTitle('pay')).toBe('결제 방식 선택 · 카페 주문 연습')
  })
})
