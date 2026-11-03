import { useEffect, useState } from 'react'
import type { DineType } from '../App'
import { cartTotals, formatWon, type CartLine } from '../cart'

export type PayMethod = 'card' | 'qr' | 'cash'

const METHODS: { id: PayMethod; icon: string; name: string; desc: string }[] = [
  { id: 'card', icon: '💳', name: '카드 결제', desc: '신용 · 체크카드' },
  { id: 'qr', icon: '📱', name: '간편결제', desc: 'QR · 바코드 스캔' },
  { id: 'cash', icon: '💵', name: '현금 결제', desc: '카운터에서 결제' },
]

interface Props {
  dineType: DineType
  lines: CartLine[]
  onBack: () => void
  onHome: () => void
  onComplete: (method: PayMethod) => void
}

/** 결제 화면. 결제 수단을 고르고 "결제하기" 를 누르면 진행 중 화면을 잠깐 보여준 뒤 완료로 넘어간다.
 *  실제 결제 단말·PG 연동은 없다 (1차 결과물). */
export default function PayScreen({ dineType, lines, onBack, onHome, onComplete }: Props) {
  const [method, setMethod] = useState<PayMethod | null>(null)
  const [processing, setProcessing] = useState(false)
  const totals = cartTotals(lines)

  // 진행 중 화면을 2.2초 보여주고 완료로 넘어간다 (결제 단말 응답을 흉내 낸 것)
  useEffect(() => {
    if (!processing || !method) return
    const t = window.setTimeout(() => onComplete(method), 2200)
    return () => window.clearTimeout(t)
  }, [processing, method, onComplete])

  const guide: Record<PayMethod, string> = {
    card: '아래 단말기에 카드를 꽂거나 대 주세요',
    qr: '휴대폰의 결제 바코드를 스캐너에 대 주세요',
    cash: '주문번호를 들고 카운터로 와 주세요',
  }

  return (
    <div className="pay-layout">
      <header className="topbar">
        <button type="button" className="btn ghost small" onClick={onBack} disabled={processing}>← 주문 확인으로</button>
        <span className="dine-badge">{dineType === 'store' ? '🪑 매장' : '🛍️ 포장'}</span>
        <button type="button" className="btn ghost small" onClick={onHome} disabled={processing}>처음으로</button>
      </header>

      <div className="pay-body">
        <section className="pay-summary pay-amount" aria-label="결제할 금액">
          <span className="muted">결제할 금액 · {totals.count}개</span>
          <strong className="pay-amount-num">{formatWon(totals.total)}</strong>
        </section>

        <section className="pay-methods" aria-label="결제 수단">
          <h2>어떻게 결제하시겠어요?</h2>
          <div className="method-grid">
            {METHODS.map((m) => (
              <button
                key={m.id}
                type="button"
                className={`method${method === m.id ? ' on' : ''}`}
                aria-pressed={method === m.id}
                onClick={() => setMethod(m.id)}
                disabled={processing}
              >
                <span className="method-icon" aria-hidden="true">{m.icon}</span>
                <span className="method-name">{m.name}</span>
                <span className="method-desc">{m.desc}</span>
              </button>
            ))}
          </div>
          <button type="button" className="btn primary xl" disabled={!method || processing} onClick={() => setProcessing(true)}>
            {method ? `${formatWon(totals.total)} 결제하기` : '결제 수단을 선택해 주세요'}
          </button>
          <p className="demo-note">체험용 화면입니다. 실제 결제는 이루어지지 않습니다.</p>
        </section>
      </div>

      {processing && method && (
        <div className="modal-backdrop" role="presentation">
          <div className="modal center" role="dialog" aria-modal="true" aria-live="assertive">
            <div className="spinner" aria-hidden="true" />
            <h2>결제를 진행하고 있어요</h2>
            <p className="muted">{guide[method]}</p>
            <p className="muted small">결제가 끝날 때까지 화면을 벗어나지 마세요</p>
          </div>
        </div>
      )}
    </div>
  )
}
