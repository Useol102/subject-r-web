import { useEffect, useState } from 'react'
import type { CompletedOrder } from '../App'
import { formatOrderNumber, formatWon } from '../cart'
import { METHOD_NAME } from './PayScreen'

interface Props {
  order: CompletedOrder
  onHome: () => void
}

/** 완료 화면이 떠 있다가 처음으로 돌아가기까지의 시간(초) */
const RETURN_S = 20

/** 주문 완료 화면. 주문번호를 가장 크게 보여준다 */
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

  const count = order.lines.reduce((n, l) => n + l.qty, 0)
  const cash = order.method === 'cash'

  return (
    <div className="screen">
      <header className="hdr">
        <div className="hdr-side" />
        <h1 className="hdr-title">주문 완료</h1>
        <div className="hdr-side" />
      </header>
      <main className="body done-body">
        <p className="done-lead">{cash ? '주문이 접수되었습니다' : '결제가 완료되었습니다'}</p>
        <div className="ticket">
          <span className="ticket-label">주문번호</span>
          <span className="ticket-no num">{formatOrderNumber(order.number)}</span>
        </div>
        <p className="done-guide">
          {cash
            ? '이 번호를 카운터에 말씀하시고 결제해 주세요.'
            : '주문번호가 화면에 나오면 픽업대에서 받아 가세요.'}
        </p>
        <dl className="done-info">
          <div><dt>드시는 곳</dt><dd>{order.dineType === 'store' ? '매장' : '포장'}</dd></div>
          <div><dt>주문 수량</dt><dd><span className="num">{count}</span>개</dd></div>
          <div><dt>결제 방식</dt><dd>{METHOD_NAME[order.method]}</dd></div>
          <div><dt>{cash ? '결제할 금액' : '결제 금액'}</dt><dd className="num">{formatWon(order.total)}</dd></div>
        </dl>
      </main>
      <footer className="foot">
        <span className="foot-note"><b className="num">{left}</b>초 뒤 처음 화면으로 돌아갑니다.</span>
        <button type="button" className="btn btn-main btn-xl" onClick={onHome}>확인</button>
      </footer>
    </div>
  )
}
