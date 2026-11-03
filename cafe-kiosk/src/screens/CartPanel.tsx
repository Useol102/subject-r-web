import { formatWon, lineTotal, optionLabel, type CartLine, type CartTotals } from '../cart'

interface Props {
  lines: CartLine[]
  totals: CartTotals
  /** 좁은 화면에서 목록을 펼쳤는지 */
  open: boolean
  onToggle: () => void
  onChangeQty: (key: string, delta: number) => void
  onRemove: (key: string) => void
  onClear: () => void
  onCheckout: () => void
}

/** 장바구니. 넓은 화면에선 오른쪽 세로 패널, 좁은 화면에선 아래 바 + 펼침 목록 */
export default function CartPanel({ lines, totals, open, onToggle, onChangeQty, onRemove, onClear, onCheckout }: Props) {
  const empty = lines.length === 0
  return (
    <aside className={`cart${open ? ' open' : ''}`} aria-label="장바구니">
      <button type="button" className="cart-handle" onClick={onToggle} aria-expanded={open}>
        <span>🧺 장바구니 <strong>{totals.count}</strong></span>
        <span className="cart-handle-total">{formatWon(totals.total)}</span>
        <span className="chev" aria-hidden="true">{open ? '▼' : '▲'}</span>
      </button>

      <div className="cart-head">
        <h2>장바구니</h2>
        {!empty && (
          <button type="button" className="btn ghost small" onClick={onClear}>전체 삭제</button>
        )}
      </div>

      <ul className="cart-list">
        {empty && <li className="cart-empty">메뉴를 눌러 담아 주세요</li>}
        {lines.map((l) => (
          <li key={l.key} className="cart-line">
            <div className="cart-line-info">
              <span className="cart-line-name">{l.item.emoji} {l.item.name}</span>
              {optionLabel(l) && <span className="cart-line-opt">{optionLabel(l)}</span>}
              <span className="cart-line-price">{formatWon(lineTotal(l))}</span>
            </div>
            <div className="cart-line-ctl">
              <div className="stepper">
                <button type="button" aria-label={`${l.item.name} 수량 줄이기`} onClick={() => onChangeQty(l.key, -1)}>−</button>
                <span className="stepper-num">{l.qty}</span>
                <button type="button" aria-label={`${l.item.name} 수량 늘리기`} onClick={() => onChangeQty(l.key, 1)}>+</button>
              </div>
              <button type="button" className="btn-x" aria-label={`${l.item.name} 삭제`} onClick={() => onRemove(l.key)}>✕</button>
            </div>
          </li>
        ))}
      </ul>

      <div className="cart-foot">
        <div className="cart-total-row">
          <span>총 {totals.count}개</span>
          <strong className="cart-total">{formatWon(totals.total)}</strong>
        </div>
        <button type="button" className="btn primary xl" disabled={empty} onClick={onCheckout}>
          {empty ? '메뉴를 담아 주세요' : `${formatWon(totals.total)} 주문하기`}
        </button>
      </div>
    </aside>
  )
}
