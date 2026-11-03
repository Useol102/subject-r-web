import type { DineType } from '../App'

interface Props {
  onStart: (type: DineType) => void
}

/** 시작 화면. 실제 매장 키오스크처럼 "먹고 가기 / 포장하기" 두 개만 크게 둔다 */
export default function StartScreen({ onStart }: Props) {
  return (
    <main className="start">
      <div className="start-top">
        <p className="start-kicker">카페 주문</p>
        <h1 className="start-title">주문하실 곳을<br />선택해 주세요</h1>
      </div>
      <div className="start-choices">
        <button type="button" className="choice" onClick={() => onStart('store')}>
          <svg className="choice-icon" viewBox="0 0 64 64" aria-hidden="true">
            <rect x="8" y="44" width="48" height="5" rx="2" fill="currentColor" />
            <path d="M16 22h26v10a12 12 0 0 1-12 12h-2a12 12 0 0 1-12-12z" fill="none" stroke="currentColor" strokeWidth="4" strokeLinejoin="round" />
            <path d="M42 26h3a6 6 0 0 1 0 12h-3" fill="none" stroke="currentColor" strokeWidth="4" />
            <path d="M24 10c-2 3 2 5 0 8M32 10c-2 3 2 5 0 8" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
          </svg>
          <span className="choice-title">매장에서 먹고 가기</span>
        </button>
        <button type="button" className="choice" onClick={() => onStart('togo')}>
          <svg className="choice-icon" viewBox="0 0 64 64" aria-hidden="true">
            <path d="M12 20h40l-3 36H15z" fill="none" stroke="currentColor" strokeWidth="4" strokeLinejoin="round" />
            <path d="M23 26v-8a9 9 0 0 1 18 0v8" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
          </svg>
          <span className="choice-title">포장해서 가져가기</span>
        </button>
      </div>
      <p className="start-foot">교육용 연습 화면입니다. 실제로 결제되지 않습니다.</p>
    </main>
  )
}
