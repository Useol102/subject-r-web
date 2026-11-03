import type { DineType } from '../App'

interface Props {
  onStart: (type: DineType) => void
}

/** 첫 화면: 매장/포장 선택으로 주문을 시작한다 */
export default function StartScreen({ onStart }: Props) {
  return (
    <main className="start">
      <div className="start-hero">
        <div className="logo" aria-hidden="true">☕</div>
        <h1>어서 오세요</h1>
        <p className="start-sub">주문하실 방법을 선택해 주세요</p>
      </div>
      <div className="start-choices">
        <button type="button" className="choice" onClick={() => onStart('store')}>
          <span className="choice-icon" aria-hidden="true">🪑</span>
          <span className="choice-title">매장에서 먹고 갈게요</span>
          <span className="choice-sub">머그잔 · 접시로 드려요</span>
        </button>
        <button type="button" className="choice" onClick={() => onStart('togo')}>
          <span className="choice-icon" aria-hidden="true">🛍️</span>
          <span className="choice-title">포장해 갈게요</span>
          <span className="choice-sub">일회용 컵 · 포장 용기로 드려요</span>
        </button>
      </div>
      <p className="demo-note">체험용 화면입니다. 실제 결제는 이루어지지 않습니다.</p>
    </main>
  )
}
