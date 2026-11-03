import { useState } from 'react'
import type { DineType } from '../App'
import { cartTotals, defaultOptions, formatWon, needsOptionSheet, type CartLine, type LineOptions } from '../cart'
import { CATEGORIES, MENU, type CategoryId, type MenuItem } from '../menu'
import OptionSheet from './OptionSheet'
import CartPanel from './CartPanel'

interface Props {
  dineType: DineType
  lines: CartLine[]
  onAdd: (item: MenuItem, opts: LineOptions, qty: number) => void
  onChangeQty: (key: string, delta: number) => void
  onRemove: (key: string) => void
  onClear: () => void
  onHome: () => void
  onCheckout: () => void
}

/** 메뉴 고르기 화면. 왼쪽 메뉴 격자 + 오른쪽(좁으면 아래) 장바구니 */
export default function MenuScreen({ dineType, lines, onAdd, onChangeQty, onRemove, onClear, onHome, onCheckout }: Props) {
  const [category, setCategory] = useState<CategoryId>('coffee')
  const [picking, setPicking] = useState<MenuItem | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [cartOpen, setCartOpen] = useState(false)

  const items = MENU.filter((m) => m.category === category)
  const totals = cartTotals(lines)

  const showToast = (msg: string) => {
    setToast(msg)
    window.setTimeout(() => setToast((t) => (t === msg ? null : t)), 1400)
  }

  const pick = (item: MenuItem) => {
    if (item.soldOut) return
    if (needsOptionSheet(item)) {
      setPicking(item)
    } else {
      onAdd(item, defaultOptions(item), 1)
      showToast(`${item.name} 1개를 담았어요`)
    }
  }

  const confirmOptions = (opts: LineOptions, qty: number) => {
    if (!picking) return
    onAdd(picking, opts, qty)
    showToast(`${picking.name} ${qty}개를 담았어요`)
    setPicking(null)
  }

  return (
    <div className="menu-layout">
      <header className="topbar">
        <button type="button" className="btn ghost small" onClick={onHome}>← 처음으로</button>
        <span className="dine-badge">{dineType === 'store' ? '🪑 매장' : '🛍️ 포장'}</span>
      </header>

      <nav className="tabs" aria-label="메뉴 분류">
        {CATEGORIES.map((c) => (
          <button
            key={c.id}
            type="button"
            className={`tab${c.id === category ? ' active' : ''}`}
            aria-pressed={c.id === category}
            onClick={() => setCategory(c.id)}
          >
            {c.name}
          </button>
        ))}
      </nav>

      <section className="grid-wrap" aria-label="메뉴 목록">
        <div className="grid">
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`card${item.soldOut ? ' soldout' : ''}`}
              onClick={() => pick(item)}
              disabled={item.soldOut}
              aria-label={`${item.name} ${formatWon(item.price)}${item.soldOut ? ' 품절' : ''}`}
            >
              <span className="card-emoji" aria-hidden="true">{item.emoji}</span>
              <span className="card-name">{item.name}</span>
              <span className="card-desc">{item.desc}</span>
              <span className="card-price">{formatWon(item.price)}</span>
              {item.soldOut && <span className="soldout-badge" aria-hidden="true" />}
              {item.iceOnly && !item.soldOut && <span className="tag ice">ICE ONLY</span>}
              {item.hotOnly && !item.soldOut && <span className="tag hot">HOT ONLY</span>}
            </button>
          ))}
        </div>
      </section>

      <CartPanel
        lines={lines}
        totals={totals}
        open={cartOpen}
        onToggle={() => setCartOpen((o) => !o)}
        onChangeQty={onChangeQty}
        onRemove={onRemove}
        onClear={onClear}
        onCheckout={onCheckout}
      />

      {picking && <OptionSheet item={picking} onCancel={() => setPicking(null)} onConfirm={confirmOptions} />}
      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  )
}
