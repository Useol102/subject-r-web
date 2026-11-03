import type { DineType } from '../App'
import { cartTotals, formatWon, lineTotal, optionLabel, unitPrice, type CartLine } from '../cart'

interface Props {
  dineType: DineType
  lines: CartLine[]
  onChangeDine: (type: DineType) => void
  onChangeQty: (key: string, delta: number) => void
  onRemove: (key: string) => void
  onBack: () => void
  onHome: () => void
  onNext: () => void
}

/** 주문 확인 화면. 담은 메뉴·수량·금액을 크게 보여주고, 여기서도 수량을 고칠 수 있다 */
export default function ConfirmScreen({ dineType, lines, onChangeDine, onChangeQty, onRemove, onBack, onHome, onNext }: Props) {
  const totals = cartTotals(lines)
  const empty = lines.length === 0
  return (
    <div className="pay-layout">
      <header className="topbar">
        <button type="button" className="btn ghost small" onClick={onBack}>← 메뉴 더 고르기</button>
        <span className="dine-badge">주문 확인</span>
        <button type="button" className="btn ghost small" onClick={onHome}>처음으로</button>
      </header>

      <div className="pay-body confirm-body">
        <section className="pay-summary" aria-labelledby="confirm-title">
          <h2 id="confirm-title" className="confirm-title">주문하신 메뉴가 맞나요?</h2>
          {empty ? (
            <p className="cart-empty">담은 메뉴가 없어요. 메뉴를 다시 골라 주세요.</p>
          ) : (
            <ul className="confirm-list">
              {lines.map((l) => (
                <li key={l.key} className="confirm-line">
                  <div className="confirm-info">
                    <span className="confirm-name">{l.item.emoji} {l.item.name}</span>
                    <span className="confirm-opt">
                      {optionLabel(l) ? `${optionLabel(l)} · ` : ''}1개 {formatWon(unitPrice(l.item, l))}
                    </span>
                  </div>
                  <div className="stepper large">
                    <button type="button" aria-label={`${l.item.name} 수량 줄이기`} onClick={() => onChangeQty(l.key, -1)}>−</button>
                    <span className="stepper-num">{l.qty}</span>
                    <button type="button" aria-label={`${l.item.name} 수량 늘리기`} onClick={() => onChangeQty(l.key, 1)}>+</button>
                  </div>
                  <span className="confirm-price">{formatWon(lineTotal(l))}</span>
                  <button type="button" className="btn-x" aria-label={`${l.item.name} 삭제`} onClick={() => onRemove(l.key)}>✕</button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="pay-methods" aria-label="결제 금액">
          <h2>드시는 곳</h2>
          <div className="pills">
            <button type="button" className={`pill${dineType === 'store' ? ' on' : ''}`} aria-pressed={dineType === 'store'} onClick={() => onChangeDine('store')}>
              🪑 매장
            </button>
            <button type="button" className={`pill${dineType === 'togo' ? ' on' : ''}`} aria-pressed={dineType === 'togo'} onClick={() => onChangeDine('togo')}>
              🛍️ 포장
            </button>
          </div>
          <div className="summary-total">
            <span>총 {totals.count}개</span>
            <strong>{formatWon(totals.total)}</strong>
          </div>
          <button type="button" className="btn primary xl" disabled={empty} onClick={onNext}>
            {empty ? '메뉴를 담아 주세요' : '결제 방식 고르기 →'}
          </button>
        </section>
      </div>
    </div>
  )
}
