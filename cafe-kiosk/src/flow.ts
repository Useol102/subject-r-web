// 주문 진행 단계 표시. DOM 을 모르는 순수 함수로 두고 flow.test.ts 로 검증한다.

export type Screen = 'start' | 'menu' | 'confirm' | 'pay' | 'done'

export interface FlowStep {
  id: Exclude<Screen, 'start'>
  label: string
}

/** 상단 진행 단계 (시작 화면에는 표시하지 않는다) */
export const FLOW_STEPS: FlowStep[] = [
  { id: 'menu', label: '메뉴 선택' },
  { id: 'confirm', label: '주문 확인' },
  { id: 'pay', label: '결제 방식' },
  { id: 'done', label: '주문 완료' },
]

/** 화면 이름. 브라우저 탭 제목과 화면 읽기 프로그램이 쓴다 */
export const SCREEN_LABEL: Record<Screen, string> = {
  start: '시작 화면',
  menu: '메뉴 선택',
  confirm: '주문 확인',
  pay: '결제 방식 선택',
  done: '주문 완료',
}

/** 진행 단계 아래 한 줄 안내 */
export const FLOW_HELP: Record<Exclude<Screen, 'start'>, string> = {
  menu: '메뉴를 누른 뒤 온도·크기·수량을 선택해 주세요.',
  confirm: '메뉴와 수량, 총 금액을 확인해 주세요.',
  pay: '결제 방식을 눌러 연습을 마쳐 주세요. 실제로 결제되지 않습니다.',
  done: '주문 연습을 마쳤습니다. 실제 주문은 접수되지 않았습니다.',
}

export type StepState = 'done' | 'current' | 'todo'

/** 각 단계가 지난 단계 / 지금 단계 / 남은 단계 중 무엇인지 */
export function stepStates(screen: Screen): StepState[] {
  const current = FLOW_STEPS.findIndex((s) => s.id === screen)
  return FLOW_STEPS.map((_, i) => (current < 0 ? 'todo' : i < current ? 'done' : i === current ? 'current' : 'todo'))
}

/** 브라우저 탭 제목 */
export function pageTitle(screen: Screen): string {
  return `${SCREEN_LABEL[screen]} · 카페 주문 연습`
}
