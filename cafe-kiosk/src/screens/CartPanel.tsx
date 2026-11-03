import { useEffect, useRef } from 'react'
import { cartTotals, formatWon, lineTotal, optionLabel, type CartLine } from '../cart'

interface Props {
  lines: CartLine[]
  /** 방금 담은 줄의 키. 그 줄을 잠깐 강조하고 보이게 스크롤한다 */
  highlightKey: string | null
  onChangeQty: (key: string, delta: number) => void
  onRemove: (key: string) => void
  onClear: () => void
  onNext: () => void
}

/** 화면 아래 주문 내역. 실제 키오스크처럼 목록 + 합계 + 주문하기 버튼 */
export default function CartPanel({ lines, highlightKey, onChangeQty, onRemove, onClear, onNext }: Props) {
  const totals = cartTotals(lines)
  const empty = lines.length === 0
  const listRef = useRef<HTMLOListElement>(null)

  useEffect(() => {
    if (!highlightKey || !listRef.current) return
    const el = listRef.current.querySelector<HTMLElement>(`[data-key="${CSS.escape(highlightKey)}"]`)
    el?.scrollIntoView({ block: 'nearest' })
  }, [highlightKey, lines])

  return (
    <aside className="cart" aria-label="주문 내역">
      <div className="cart-main">
        <div className="cart-head">
          <h2 className="cart-title">주문 내역 <span className="num">{totals.count}</span>개</h2>
          <button type="button" className="btn-text" onClick={onClear} disabled={empty}>전체 삭제</button>
        </div>
        {empty ? (
          <p className="cart-empty">위에서 메뉴를 눌러 주세요</p>
        ) : (
          <ol className="cart-list" ref={listRef}>
            {lines.map((l) => (
              <li key={l.key} data-key={l.key} className={`cart-row${l.key === highlightKey ? ' hl' : ''}`}>
                <span className="cart-name">
                  {l.item.name}
                  {optionLabel(l) && <span className="cart-opt">{optionLabel(l)}</span>}
                </span>
                <span className="qty">
                  <button type="button" aria-label={`${l.item.name} 한 개 빼기`} onClick={() => onChangeQty(l.key, -1)}>−</button>
                  <span className="qty-num">{l.qty}</span>
                  <button type="button" aria-label={`${l.item.name} 한 개 더하기`} onClick={() => onChangeQty(l.key, 1)}>+</button>
                </span>
                <span className="cart-price">{formatWon(lineTotal(l))}</span>
                <button type="button" className="btn-del" aria-label={`${l.item.name} 삭제`} onClick={() => onRemove(l.key)}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
                </button>
              </li>
            ))}
          </ol>
        )}
      </div>
      <div className="cart-side">
        <div className="cart-sum">
          <span>총 금액</span>
          <strong className="num">{formatWon(totals.total)}</strong>
        </div>
        <button type="button" className="btn btn-main btn-xl" disabled={empty} onClick={onNext}>
          주문하기
        </button>
      </div>
    </aside>
  )
}
