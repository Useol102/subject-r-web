// 메뉴 데이터. 1차 결과물이라 백엔드 없이 여기 상수로 둔다.
// 나중에 서버가 생기면 이 파일만 API 응답으로 바꾸면 된다.

export type CategoryId = 'coffee' | 'noncoffee' | 'tea' | 'dessert'

export interface Category {
  id: CategoryId
  name: string
}

/** 사진이 없을 때 그리는 기본 그림 종류 (src/screens/MenuArt.tsx) */
export type ArtKind = 'ice' | 'hot' | 'mug' | 'cookie' | 'croissant' | 'bagel' | 'macaron' | 'cake'

export interface MenuItem {
  id: string
  category: CategoryId
  name: string
  /** 기본(레귤러) 가격, 원 */
  price: number
  /** 기본 그림 종류와 음료·음식 색 */
  art: ArtKind
  tone: string
  /**
   * 실제 메뉴 사진. public/menu/ 에 파일을 넣고 'menu/americano.jpg' 처럼 적는다.
   * 비워 두면 기본 그림을 쓴다. 외부 주소는 쓰지 않는다(인터넷 없이 돌아야 한다).
   */
  photo?: string
  /** 온도(HOT/ICE) 선택 가능 여부 */
  hasTemperature: boolean
  /** 사이즈(기본/라지) 선택 가능 여부 */
  hasSize: boolean
  /** ICE 만 되는 메뉴 (예: 스무디) */
  iceOnly?: boolean
  /** HOT 만 되는 메뉴 */
  hotOnly?: boolean
  soldOut?: boolean
}

export const CATEGORIES: Category[] = [
  { id: 'coffee', name: '커피' },
  { id: 'noncoffee', name: '음료' },
  { id: 'tea', name: '차' },
  { id: 'dessert', name: '디저트' },
]

/** 라지 사이즈 추가 금액 */
export const LARGE_EXTRA = 500

export const MENU: MenuItem[] = [
  // 커피
  { id: 'americano', category: 'coffee', name: '아메리카노', price: 4000, art: 'hot', tone: '#4A2C1D', hasTemperature: true, hasSize: true },
  { id: 'latte', category: 'coffee', name: '카페라떼', price: 4500, art: 'hot', tone: '#B08463', hasTemperature: true, hasSize: true },
  { id: 'vanilla-latte', category: 'coffee', name: '바닐라라떼', price: 5000, art: 'hot', tone: '#C9A77F', hasTemperature: true, hasSize: true },
  { id: 'caramel-macchiato', category: 'coffee', name: '카라멜마키아또', price: 5300, art: 'hot', tone: '#A9662F', hasTemperature: true, hasSize: true },
  { id: 'cold-brew', category: 'coffee', name: '콜드브루', price: 4800, art: 'ice', tone: '#3B2316', hasTemperature: true, hasSize: true, iceOnly: true },
  { id: 'espresso', category: 'coffee', name: '에스프레소', price: 3500, art: 'mug', tone: '#3B2316', hasTemperature: true, hasSize: false, hotOnly: true },
  // 음료
  { id: 'choco-latte', category: 'noncoffee', name: '초코라떼', price: 4800, art: 'hot', tone: '#6B3E26', hasTemperature: true, hasSize: true },
  { id: 'green-tea-latte', category: 'noncoffee', name: '녹차라떼', price: 4800, art: 'hot', tone: '#7FA650', hasTemperature: true, hasSize: true },
  { id: 'strawberry-smoothie', category: 'noncoffee', name: '딸기 스무디', price: 5500, art: 'ice', tone: '#E0526A', hasTemperature: true, hasSize: true, iceOnly: true },
  { id: 'mango-smoothie', category: 'noncoffee', name: '망고 스무디', price: 5500, art: 'ice', tone: '#F2A93B', hasTemperature: true, hasSize: true, iceOnly: true },
  { id: 'lemonade', category: 'noncoffee', name: '레모네이드', price: 4500, art: 'ice', tone: '#F1D54B', hasTemperature: true, hasSize: true, iceOnly: true },
  // 차
  { id: 'earl-grey', category: 'tea', name: '얼그레이', price: 4000, art: 'mug', tone: '#8A4B22', hasTemperature: true, hasSize: true },
  { id: 'chamomile', category: 'tea', name: '캐모마일', price: 4000, art: 'mug', tone: '#D9B44A', hasTemperature: true, hasSize: true },
  { id: 'peppermint', category: 'tea', name: '페퍼민트', price: 4000, art: 'mug', tone: '#8DB86B', hasTemperature: true, hasSize: true },
  { id: 'yuja', category: 'tea', name: '유자차', price: 4500, art: 'mug', tone: '#F0A830', hasTemperature: true, hasSize: true },
  // 디저트
  { id: 'croissant', category: 'dessert', name: '크루아상', price: 3800, art: 'croissant', tone: '#D99A4E', hasTemperature: false, hasSize: false },
  { id: 'cheesecake', category: 'dessert', name: '치즈케이크', price: 6000, art: 'cake', tone: '#F3DFA2', hasTemperature: false, hasSize: false },
  { id: 'cookie', category: 'dessert', name: '초코칩 쿠키', price: 2800, art: 'cookie', tone: '#C98B4F', hasTemperature: false, hasSize: false },
  { id: 'macaron', category: 'dessert', name: '마카롱 3개', price: 6500, art: 'macaron', tone: '#E8A0B4', hasTemperature: false, hasSize: false },
  { id: 'bagel', category: 'dessert', name: '플레인 베이글', price: 3500, art: 'bagel', tone: '#D4A26A', hasTemperature: false, hasSize: false, soldOut: true },
]
