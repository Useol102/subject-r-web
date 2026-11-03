import { useEffect, useState } from 'react'
import type { CompletedOrder } from '../App'
import { formatOrderNumber, formatWon, lineTotal, optionLabel } from '../cart'

interface Props {
  order: CompletedOrder
  onHome: () => void
}

/** 완료 화면이 떠 있다가 처음으로 돌아가기까지의 시간(초) */
const RETURN_S = 20

const METHOD_NAME = { card: '카드 결제', qr: '간편결제', cash: '현금 결제' } as const

/** 주문 완료 화면. 주문번호를 크게 보여주고 일정 시간 뒤 처음으로 돌아간다 */
export default function DoneScreen({ order, onHome }: Props) {
  const [left, setLeft] = useState(RETURN_S)
  useEffect(() => {
    if (left <= 0) {
      onHome()
      return
    }
    const t = window.setTimeout(() => setLeft((n) => n - 1), 1000)
    return () => window.clearTimeout(t)
  }, [left, onHome])

  const time = order.paidAt.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })

  return (
    <main className="done">
      <div className="done-card">
        <div className="done-check" aria-hidden="true">✓</div>
        <h1>주문이 완료되었어요</h1>
        <p className="muted">주문번호가 전광판에 뜨면 픽업대로 와 주세요</p>

        <div className="order-no-box">
          <span className="order-no-label">주문번호</span>
          <span className="order-no">{formatOrderNumber(order.number)}</span>
        </div>

        <dl className="done-meta">
          <div><dt>이용</dt><dd>{order.dineType === 'store' ? '매장' : '포장'}</dd></div>
          <div><dt>결제</dt><dd>{METHOD_NAME[order.method]}</dd></div>
          <div><dt>시각</dt><dd>{time}</dd></div>
        </dl>

        <ul className="summary-list compact">
          {order.lines.map((l) => (
            <li key={l.key}>
              <span className="summary-name">
                {l.item.name}
                {optionLabel(l) && <span className="summary-opt"> {optionLabel(l)}</span>}
              </span>
              <span className="summary-qty">× {l.qty}</span>
              <span className="summary-price">{formatWon(lineTotal(l))}</span>
            </li>
          ))}
        </ul>
        <div className="summary-total">
          <span>결제 금액</span>
          <strong>{formatWon(order.total)}</strong>
        </div>

        {order.method === 'cash' && <p className="notice">현금 결제는 카운터에서 주문번호를 말씀해 주세요.</p>}

        <button type="button" className="btn primary xl" onClick={onHome}>
          처음으로 ({left}초)
        </button>
      </div>
    </main>
  )
}
