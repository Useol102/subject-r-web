import { FLOW_HELP, FLOW_STEPS, stepStates, type Screen } from '../flow'

/** 맨 위 제목줄. 교육용 화면임을 모든 단계에서 보여준다 */
export function AppHeading() {
  return (
    <div className="app-heading">
      <span className="app-name">카페 주문 연습</span>
      <span className="education">교육용 화면 · 실제 결제 없음</span>
    </div>
  )
}

/** 주문 진행 단계: 1 메뉴 선택 → 2 주문 확인 → 3 결제 방식 → 4 주문 완료 */
export function FlowBar({ screen }: { screen: Screen }) {
  if (screen === 'start') return null
  const states = stepStates(screen)
  return (
    <nav className="flow" aria-label="주문 진행 단계">
      <ol>
        {FLOW_STEPS.map((s, i) => (
          <li key={s.id} className={states[i]} aria-current={states[i] === 'current' ? 'step' : undefined}>
            <span className="flow-number">{i + 1}</span>
            <span>{s.label}</span>
          </li>
        ))}
      </ol>
      <p className="flow-help">{FLOW_HELP[screen]}</p>
    </nav>
  )
}
