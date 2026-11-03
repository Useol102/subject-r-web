// 메뉴 데이터. 1차 결과물이라 백엔드 없이 여기 상수로 둔다.
// 나중에 서버가 생기면 이 파일만 API 응답으로 바꾸면 된다.

export type CategoryId = 'coffee' | 'noncoffee' | 'tea' | 'dessert'

export interface Category {
  id: CategoryId
  name: string
}

export interface MenuItem {
  id: string
  category: CategoryId
  name: string
  /** 기본(레귤러) 가격, 원 */
  price: number
  /** 한 줄 설명 */
  desc: string
  /** 카드에 그릴 그림 대용 이모지 (외부 이미지·CDN 을 쓰지 않는다) */
  emoji: string
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
  { id: 'noncoffee', name: '논커피' },
  { id: 'tea', name: '티' },
  { id: 'dessert', name: '디저트' },
]

/** 라지 사이즈 추가 금액 */
export const LARGE_EXTRA = 500

export const MENU: MenuItem[] = [
  // 커피
  { id: 'americano', category: 'coffee', name: '아메리카노', price: 4000, desc: '깔끔하고 진한 에스프레소에 물을 더했어요', emoji: '☕', hasTemperature: true, hasSize: true },
  { id: 'latte', category: 'coffee', name: '카페라떼', price: 4500, desc: '부드러운 우유와 에스프레소의 조화', emoji: '🥛', hasTemperature: true, hasSize: true },
  { id: 'vanilla-latte', category: 'coffee', name: '바닐라라떼', price: 5000, desc: '달콤한 바닐라 시럽을 더한 라떼', emoji: '🍦', hasTemperature: true, hasSize: true },
  { id: 'caramel-macchiato', category: 'coffee', name: '카라멜마키아또', price: 5300, desc: '카라멜 드리즐과 우유 거품', emoji: '🍮', hasTemperature: true, hasSize: true },
  { id: 'cold-brew', category: 'coffee', name: '콜드브루', price: 4800, desc: '12시간 저온 추출, 부드러운 산미', emoji: '🧊', hasTemperature: true, hasSize: true, iceOnly: true },
  { id: 'espresso', category: 'coffee', name: '에스프레소', price: 3500, desc: '진한 한 잔, 샷 2개', emoji: '🫘', hasTemperature: true, hasSize: false, hotOnly: true },
  // 논커피
  { id: 'choco-latte', category: 'noncoffee', name: '초코라떼', price: 4800, desc: '진한 초콜릿과 우유', emoji: '🍫', hasTemperature: true, hasSize: true },
  { id: 'green-tea-latte', category: 'noncoffee', name: '녹차라떼', price: 4800, desc: '제주 녹차 가루를 넣은 라떼', emoji: '🍵', hasTemperature: true, hasSize: true },
  { id: 'strawberry-smoothie', category: 'noncoffee', name: '딸기 스무디', price: 5500, desc: '생딸기를 갈아 만든 스무디', emoji: '🍓', hasTemperature: true, hasSize: true, iceOnly: true },
  { id: 'mango-smoothie', category: 'noncoffee', name: '망고 스무디', price: 5500, desc: '달콤한 망고 과육이 가득', emoji: '🥭', hasTemperature: true, hasSize: true, iceOnly: true },
  { id: 'lemonade', category: 'noncoffee', name: '레모네이드', price: 4500, desc: '상큼한 레몬과 탄산', emoji: '🍋', hasTemperature: true, hasSize: true, iceOnly: true },
  // 티
  { id: 'earl-grey', category: 'tea', name: '얼그레이', price: 4000, desc: '베르가못 향이 은은한 홍차', emoji: '🫖', hasTemperature: true, hasSize: true },
  { id: 'chamomile', category: 'tea', name: '캐모마일', price: 4000, desc: '잠들기 전 마시기 좋은 허브티', emoji: '🌼', hasTemperature: true, hasSize: true },
  { id: 'peppermint', category: 'tea', name: '페퍼민트', price: 4000, desc: '시원하고 개운한 허브티', emoji: '🌿', hasTemperature: true, hasSize: true },
  { id: 'yuja', category: 'tea', name: '유자차', price: 4500, desc: '국산 유자청으로 만들었어요', emoji: '🍊', hasTemperature: true, hasSize: true },
  // 디저트
  { id: 'croissant', category: 'dessert', name: '크루아상', price: 3800, desc: '버터 향 가득한 결', emoji: '🥐', hasTemperature: false, hasSize: false },
  { id: 'cheesecake', category: 'dessert', name: '치즈케이크', price: 6000, desc: '뉴욕 스타일 진한 치즈케이크', emoji: '🍰', hasTemperature: false, hasSize: false },
  { id: 'cookie', category: 'dessert', name: '초코칩 쿠키', price: 2800, desc: '겉은 바삭, 속은 촉촉', emoji: '🍪', hasTemperature: false, hasSize: false },
  { id: 'macaron', category: 'dessert', name: '마카롱 (3개)', price: 6500, desc: '오늘의 맛 3종 모음', emoji: '🧁', hasTemperature: false, hasSize: false },
  { id: 'bagel', category: 'dessert', name: '플레인 베이글', price: 3500, desc: '크림치즈 포함', emoji: '🥯', hasTemperature: false, hasSize: false, soldOut: true },
]
