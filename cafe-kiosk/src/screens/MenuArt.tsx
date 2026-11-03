import type { MenuItem } from '../menu'

interface Props {
  item: MenuItem
}

/**
 * 메뉴 그림. 사진(item.photo)이 있으면 사진을, 없으면 단순한 기본 그림을 그린다.
 * 기본 그림은 "무슨 종류인지" 정도만 알려주는 용도다. 실제 운영 전에 사진으로 바꾸는 것을 권한다.
 */
export default function MenuArt({ item }: Props) {
  if (item.photo) {
    return <img className="art-img" src={item.photo} alt="" draggable={false} />
  }
  const t = item.tone
  const line = '#8A9099'
  return (
    <svg className="art-svg" viewBox="0 0 120 120" aria-hidden="true">
      {item.art === 'ice' && (
        <g>
          <rect x="63" y="6" width="6" height="34" rx="2" fill="#5B6470" transform="rotate(14 66 23)" />
          <path d="M33 30 Q60 20 87 30 L85 38 H35 Z" fill="#F3F4F6" stroke={line} strokeWidth="2" />
          <path d="M36 38 H84 L77 110 H43 Z" fill="#FFFFFF" stroke={line} strokeWidth="2" strokeLinejoin="round" />
          <path d="M38.6 52 H81.4 L75.4 107.5 H44.6 Z" fill={t} />
          <rect x="46" y="56" width="11" height="11" rx="2" fill="#FFFFFF" opacity=".55" />
          <rect x="61" y="61" width="11" height="11" rx="2" fill="#FFFFFF" opacity=".45" />
          <rect x="51" y="72" width="11" height="11" rx="2" fill="#FFFFFF" opacity=".35" />
        </g>
      )}
      {item.art === 'hot' && (
        <g>
          <rect x="33" y="24" width="54" height="12" rx="3" fill="#3F4650" />
          <rect x="38" y="18" width="44" height="8" rx="3" fill="#59616C" />
          <path d="M37 36 H83 L77 110 H43 Z" fill="#FFFFFF" stroke={line} strokeWidth="2" strokeLinejoin="round" />
          <path d="M39.8 58 H80.2 L78.2 86 H41.8 Z" fill={t} />
        </g>
      )}
      {item.art === 'mug' && (
        <g>
          <ellipse cx="58" cy="102" rx="40" ry="7" fill="#E5E7EB" stroke={line} strokeWidth="2" />
          <path d="M84 56 h5 a12 12 0 0 1 0 24 h-6" fill="none" stroke={line} strokeWidth="5" />
          <path d="M30 48 H86 V72 A24 24 0 0 1 62 96 H54 A24 24 0 0 1 30 72 Z" fill="#FFFFFF" stroke={line} strokeWidth="2" />
          <ellipse cx="58" cy="50" rx="25" ry="5" fill={t} />
        </g>
      )}
      {item.art !== 'ice' && item.art !== 'hot' && item.art !== 'mug' && (
        <ellipse cx="60" cy="96" rx="48" ry="12" fill="#FFFFFF" stroke={line} strokeWidth="2" />
      )}
      {item.art === 'cookie' && (
        <g>
          <circle cx="60" cy="74" r="28" fill={t} />
          <circle cx="50" cy="66" r="4" fill="#4A2C1D" />
          <circle cx="66" cy="62" r="3.5" fill="#4A2C1D" />
          <circle cx="70" cy="80" r="4" fill="#4A2C1D" />
          <circle cx="54" cy="84" r="3" fill="#4A2C1D" />
        </g>
      )}
      {item.art === 'croissant' && (
        <path d="M20 82 Q30 46 60 44 Q90 46 100 82 Q88 72 80 76 Q72 60 60 60 Q48 60 40 76 Q32 72 20 82 Z" fill={t} stroke="#A86A2C" strokeWidth="2" strokeLinejoin="round" />
      )}
      {item.art === 'bagel' && (
        <g>
          <ellipse cx="60" cy="76" rx="34" ry="20" fill={t} />
          <ellipse cx="60" cy="74" rx="10" ry="5" fill="#FFFFFF" />
        </g>
      )}
      {item.art === 'macaron' && (
        <g>
          <ellipse cx="40" cy="80" rx="16" ry="10" fill={t} />
          <ellipse cx="60" cy="72" rx="16" ry="10" fill="#B7D88C" />
          <ellipse cx="80" cy="80" rx="16" ry="10" fill="#C8A3E0" />
          <rect x="26" y="78" width="28" height="3" fill="#FFFFFF" />
          <rect x="46" y="70" width="28" height="3" fill="#FFFFFF" />
          <rect x="66" y="78" width="28" height="3" fill="#FFFFFF" />
        </g>
      )}
      {item.art === 'cake' && (
        <g>
          <path d="M26 74 L94 60 L94 88 L26 98 Z" fill={t} stroke="#C9A85A" strokeWidth="2" strokeLinejoin="round" />
          <path d="M26 74 L94 60 L80 52 Z" fill="#FBF1D0" stroke="#C9A85A" strokeWidth="2" strokeLinejoin="round" />
          <path d="M26 92 L94 82 L94 88 L26 98 Z" fill="#B07A3C" />
        </g>
      )}
    </svg>
  )
}
