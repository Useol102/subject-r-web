import { useEffect, useState } from 'react'
import { cartTotals, formatWon, type CartLine } from '../cart'
import Header from './Header'

export type PayMethod = 'card' | 'qr' | 'cash'

export const METHOD_NAME: Record<PayMethod, string> = { card: '카드 결제', qr: '간편결제', cash: '카운터 결제' }

interface Props {
  lines: CartLine[]
  timeLeft: number
  /** 결제 진행 창이 떠 있는지 (App 이 남은 시간을 멈추는 데 쓴다) */
  paying: boolean
  onPayingChange: (paying: boolean) => void
  onBack: () => void
  onHome: () => void
  onComplete: (method: PayMethod) => void
}

/** 단말기 응답을 흉내 내는 시간 */
const FAKE_PAY_MS = 3500

/**
 * 결제 방식 선택. 실제 키오스크처럼 방식을 누르면 바로 안내 창이 뜨고, 잠시 뒤 완료된다.
 * 실제 결제 단말·PG 연동은 없다.
 */
export default function PayScreen({ lines, timeLeft, paying, onPayingChange, onBack, onHome, onComplete }: Props) {
  const [method, setMethod] = useState<PayMethod>('card')
  const totals = cartTotals(lines)

  useEffect(() => {
    if (!paying) return
    const t = window.setTimeout(() => onComplete(method), FAKE_PAY_MS)
    return () => window.clearTimeout(t)
  }, [paying, method, onComplete])

  const choose = (m: PayMethod) => {
    setMethod(m)
    onPayingChange(true)
  }

  return (
    <div className="screen">
      <Header title="결제 방식 선택" timeLeft={timeLeft} onHome={onHome} />
      <main className="body">
        <div className="pay-total">
          <span>결제하실 금액</span>
          <strong className="num">{formatWon(totals.total)}</strong>
        </div>
        <h2 className="body-title">결제 방식을 선택해 주세요</h2>
        <div className="methods">
          <button type="button" className="method" onClick={() => choose('card')}>
            <svg className="method-icon" viewBox="0 0 64 64" aria-hidden="true"><rect x="6" y="14" width="52" height="36" rx="5" fill="none" stroke="currentColor" strokeWidth="4" /><rect x="6" y="22" width="52" height="7" fill="currentColor" /><rect x="14" y="38" width="14" height="5" rx="1" fill="currentColor" /></svg>
            <span className="method-name">카드 결제</span>
            <span className="method-desc">신용카드 · 체크카드</span>
          </button>
          <button type="button" className="method" onClick={() => choose('qr')}>
            <svg className="method-icon" viewBox="0 0 64 64" aria-hidden="true"><rect x="16" y="4" width="32" height="56" rx="6" fill="none" stroke="currentColor" strokeWidth="4" /><rect x="23" y="16" width="8" height="8" fill="currentColor" /><rect x="33" y="16" width="8" height="8" fill="currentColor" /><rect x="23" y="26" width="8" height="8" fill="currentColor" /><rect x="35" y="28" width="4" height="4" fill="currentColor" /><rect x="28" y="50" width="8" height="3" rx="1.5" fill="currentColor" /></svg>
            <span className="method-name">간편결제</span>
            <span className="method-desc">휴대폰 바코드 · QR</span>
          </button>
          <button type="button" className="method" onClick={() => choose('cash')}>
            <svg className="method-icon" viewBox="0 0 64 64" aria-hidden="true"><rect x="4" y="16" width="56" height="32" rx="4" fill="none" stroke="currentColor" strokeWidth="4" /><circle cx="32" cy="32" r="7" fill="none" stroke="currentColor" strokeWidth="4" /><circle cx="14" cy="32" r="2.5" fill="currentColor" /><circle cx="50" cy="32" r="2.5" fill="currentColor" /></svg>
            <span className="method-name">카운터 결제</span>
            <span className="method-desc">현금 · 직원에게 결제</span>
          </button>
        </div>
      </main>
      <footer className="foot">
        <button type="button" className="btn btn-gray btn-xl" onClick={onBack}>이전</button>
        <span className="foot-note">교육용 연습 화면입니다. 실제로 결제되지 않습니다.</span>
      </footer>

      {paying && (
        <div className="dim" role="presentation">
          <div className="dialog pay-dialog" role="alertdialog" aria-modal="true" aria-labelledby="pay-title" aria-describedby="pay-desc">
            <PayGuideArt method={method} />
            <h2 id="pay-title" className="dialog-title">{GUIDE[method].title}</h2>
            <p id="pay-desc" className="dialog-text">{GUIDE[method].text}</p>
            <div className="progress" aria-hidden="true"><span /></div>
            <div className="dialog-actions">
              <button type="button" className="btn btn-gray" onClick={() => onPayingChange(false)}>결제 취소</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const GUIDE: Record<PayMethod, { title: string; text: string }> = {
  card: { title: '카드를 넣어 주세요', text: '화면 아래 카드 투입구에 카드를 끝까지 넣고, 결제가 끝날 때까지 빼지 마세요.' },
  qr: { title: '바코드를 보여 주세요', text: '휴대폰 결제 화면의 바코드나 QR을 화면 아래 스캐너에 가까이 대 주세요.' },
  cash: { title: '주문이 접수되고 있습니다', text: '잠시 뒤 주문번호가 나옵니다. 주문번호를 가지고 카운터에서 결제해 주세요.' },
}

/** 결제 안내 그림: 단말기에 카드 넣기 / 스캐너에 휴대폰 대기 / 카운터 */
function PayGuideArt({ method }: { method: PayMethod }) {
  return (
    <svg className="guide-art" viewBox="0 0 200 120" aria-hidden="true">
      {method === 'card' && (
        <g>
          <rect x="40" y="70" width="120" height="40" rx="6" fill="#374151" />
          <rect x="62" y="80" width="76" height="6" rx="3" fill="#111827" />
          <g className="guide-move">
            <rect x="70" y="10" width="60" height="76" rx="6" fill="#1E3A6E" />
            <rect x="80" y="20" width="14" height="10" rx="2" fill="#F2C94C" />
          </g>
        </g>
      )}
      {method === 'qr' && (
        <g>
          <rect x="50" y="88" width="100" height="22" rx="5" fill="#374151" />
          <rect x="70" y="92" width="60" height="6" rx="3" fill="#D92D20" opacity=".8" />
          <g className="guide-move">
            <rect x="76" y="6" width="48" height="76" rx="8" fill="#111827" />
            <rect x="82" y="14" width="36" height="58" rx="3" fill="#FFFFFF" />
            <rect x="88" y="26" width="10" height="10" fill="#111827" />
            <rect x="102" y="26" width="10" height="10" fill="#111827" />
            <rect x="88" y="40" width="10" height="10" fill="#111827" />
            <rect x="104" y="42" width="6" height="6" fill="#111827" />
          </g>
        </g>
      )}
      {method === 'cash' && (
        <g>
          <rect x="30" y="64" width="140" height="46" rx="6" fill="#374151" />
          <rect x="30" y="56" width="140" height="12" rx="4" fill="#4B5563" />
          <circle cx="100" cy="30" r="18" fill="#1E3A6E" />
          <text x="100" y="37" textAnchor="middle" fontSize="20" fontWeight="700" fill="#FFFFFF">번호</text>
        </g>
      )}
    </svg>
  )
}
