import type { DineType } from '../App'
import { cartTotals, formatWon, lineTotal, optionLabel, unitPrice, type CartLine } from '../cart'
import Header from './Header'

interface Props {
  dineType: DineType
  lines: CartLine[]
  timeLeft: number
  onChangeDine: (type: DineType) => void
  onChangeQty: (key: string, delta: number) => void
  onRemove: (key: string) => void
  onBack: () => void
  onHome: () => void
  onNext: () => void
}

/** 주문 확인 화면. 메뉴 · 수량 · 금액을 표로 크게 보여주고 여기서도 고칠 수 있다 */
export default function ConfirmScreen({ dineType, lines, timeLeft, onChangeDine, onChangeQty, onRemove, onBack, onHome, onNext }: Props) {
  const totals = cartTotals(lines)
  const empty = lines.length === 0
  return (
    <div className="screen">
      <Header title="주문 확인" timeLeft={timeLeft} onHome={onHome} />
      <main className="body">
        <h2 className="body-title">주문 내역을 확인해 주세요</h2>

        <div className="table-box">
          <table className="order-table">
            <thead>
              <tr>
                <th scope="col">메뉴</th>
                <th scope="col" className="c">수량</th>
                <th scope="col" className="r">금액</th>
                <th scope="col"><span className="sr-only">삭제</span></th>
              </tr>
            </thead>
            <tbody>
              {empty && (
                <tr>
                  <td colSpan={4} className="empty-cell">담은 메뉴가 없습니다. 이전 화면에서 메뉴를 골라 주세요.</td>
                </tr>
              )}
              {lines.map((l) => (
                <tr key={l.key}>
                  <td>
                    <span className="t-name">{l.item.name}</span>
                    <span className="t-sub">{optionLabel(l) ? `${optionLabel(l)} · ` : ''}1개 {formatWon(unitPrice(l.item, l))}</span>
                  </td>
                  <td className="c">
                    <span className="qty qty-lg">
                      <button type="button" aria-label={`${l.item.name} 한 개 빼기`} onClick={() => onChangeQty(l.key, -1)}>−</button>
                      <span className="qty-num">{l.qty}</span>
                      <button type="button" aria-label={`${l.item.name} 한 개 더하기`} onClick={() => onChangeQty(l.key, 1)}>+</button>
                    </span>
                  </td>
                  <td className="r t-price num">{formatWon(lineTotal(l))}</td>
                  <td className="c">
                    <button type="button" className="btn-del" aria-label={`${l.item.name} 삭제`} onClick={() => onRemove(l.key)}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="confirm-bottom">
          <div className="dine-row" role="group" aria-label="드시는 곳">
            <span className="opt-label">드시는 곳</span>
            <div className="seg">
              <button type="button" className={`seg-btn${dineType === 'store' ? ' on' : ''}`} aria-pressed={dineType === 'store'} onClick={() => onChangeDine('store')}>매장</button>
              <button type="button" className={`seg-btn${dineType === 'togo' ? ' on' : ''}`} aria-pressed={dineType === 'togo'} onClick={() => onChangeDine('togo')}>포장</button>
            </div>
          </div>
          <div className="sum-box">
            <span>총 <b className="num">{totals.count}</b>개</span>
            <strong className="num">{formatWon(totals.total)}</strong>
          </div>
        </div>
      </main>
      <footer className="foot">
        <button type="button" className="btn btn-gray btn-xl" onClick={onBack}>이전</button>
        <button type="button" className="btn btn-main btn-xl" disabled={empty} onClick={onNext}>결제하기</button>
      </footer>
    </div>
  )
}
