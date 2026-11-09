import { useState } from 'react'
import type { DineType } from '../App'
import { defaultOptions, formatWon, needsOptionSheet, type CartLine, type LineOptions } from '../cart'
import { CATEGORIES, MENU, type CategoryId, type MenuItem } from '../menu'
import Header from './Header'
import MenuArt from './MenuArt'
import OptionSheet from './OptionSheet'
import CartPanel from './CartPanel'

interface Props {
  dineType: DineType
  lines: CartLine[]
  timeLeft: number
  onAdd: (item: MenuItem, opts: LineOptions, qty: number) => void
  onChangeQty: (key: string, delta: number) => void
  onRemove: (key: string) => void
  onClear: () => void
  onHome: () => void
  onNext: () => void
}

/** 메뉴 선택 화면. 위: 분류 탭 / 가운데: 상품 / 아래: 주문 내역과 주문하기 */
export default function MenuScreen({ dineType, lines, timeLeft, onAdd, onChangeQty, onRemove, onClear, onHome, onNext }: Props) {
  const [category, setCategory] = useState<CategoryId>('coffee')
  const [picking, setPicking] = useState<MenuItem | null>(null)
  /** 방금 담은 줄. 아래 주문 내역에서 잠깐 표시해 어디에 담겼는지 보여준다 */
  const [lastKey, setLastKey] = useState<string | null>(null)

  const items = MENU.filter((m) => m.category === category)

  const put = (item: MenuItem, opts: LineOptions, qty: number) => {
    onAdd(item, opts, qty)
    setLastKey([item.id, opts.temperature ?? '-', opts.size ?? '-'].join('|'))
  }

  const pick = (item: MenuItem) => {
    if (item.soldOut) return
    if (needsOptionSheet(item)) setPicking(item)
    else put(item, defaultOptions(item), 1)
  }

  return (
    <div className="screen menu-screen">
      <Header title={dineType === 'store' ? '매장 · 메뉴 선택' : '포장 · 메뉴 선택'} timeLeft={timeLeft} onHome={onHome} />

      <nav className="tabs" aria-label="메뉴 분류">
        {CATEGORIES.map((c) => (
          <button
            key={c.id}
            type="button"
            className={`tab${c.id === category ? ' on' : ''}`}
            aria-pressed={c.id === category}
            onClick={() => setCategory(c.id)}
          >
            {c.name}
          </button>
        ))}
      </nav>

      <section className="products" aria-label="메뉴 목록">
        <div className="product-grid">
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`product${item.soldOut ? ' soldout' : ''}`}
              onClick={() => pick(item)}
              disabled={item.soldOut}
              aria-label={`${item.name} ${formatWon(item.price)}${item.soldOut ? ' 품절' : ''}`}
            >
              <span className="product-art">
                <MenuArt item={item} />
                {item.soldOut && <span className="soldout-mark">품절</span>}
              </span>
              <span className="product-name">{item.name}</span>
              <span className="product-price">{formatWon(item.price)}</span>
              <span className="product-cta" aria-hidden="true">{item.soldOut ? '품절' : '선택하기'}</span>
              {item.iceOnly && <span className="product-tag">ICE만 가능</span>}
              {item.hotOnly && <span className="product-tag hot">HOT만 가능</span>}
            </button>
          ))}
        </div>
      </section>

      <CartPanel lines={lines} highlightKey={lastKey} onChangeQty={onChangeQty} onRemove={onRemove} onClear={onClear} onNext={onNext} />

      {picking && (
        <OptionSheet
          item={picking}
          onCancel={() => setPicking(null)}
          onConfirm={(opts, qty) => {
            put(picking, opts, qty)
            setPicking(null)
          }}
        />
      )}
    </div>
  )
}
