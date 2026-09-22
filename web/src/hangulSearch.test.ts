import { describe, expect, it } from 'vitest'
import { choseongOf, normalize, scoreText, searchByName } from './hangulSearch'

// 테스트용 이름이다. 실제 기관 장소 목록이 아니다.
const places = [
  { id: 'a', name: '어울림 강당', category: '강의실' },
  { id: 'b', name: '물리치료실', category: '건강' },
  { id: 'c', name: '건강교실', category: '강의실' },
  { id: 'd', name: '화장실', category: '편의시설' },
  { id: 'e', name: 'IT 교육장', category: '강의실' },
]
const ids = (query: string) => searchByName(places, query, p => p).map(p => p.id)

describe('choseongOf', () => {
  it('완성형 음절의 초성을 준다 (쌍자음 포함)', () => {
    expect(choseongOf('물')).toBe('ㅁ')
    expect(choseongOf('강')).toBe('ㄱ')
    expect(choseongOf('쌀')).toBe('ㅆ')
    expect(choseongOf('힣')).toBe('ㅎ')
  })
  it('음절이 아니면 null', () => {
    expect(choseongOf('ㅁ')).toBeNull()
    expect(choseongOf('A')).toBeNull()
  })
})

describe('normalize', () => {
  it('공백을 모두 지우고 영문은 소문자로', () => {
    expect(normalize('  IT  교육 장 ')).toBe('it교육장')
  })
  it('조합형(NFD)으로 들어온 한글을 완성형으로 맞춘다', () => {
    expect(normalize('물리'.normalize('NFD'))).toBe('물리')
  })
})

describe('searchByName', () => {
  it('질의가 비어 있으면 원래 목록 그대로', () => {
    expect(ids('')).toEqual(['a', 'b', 'c', 'd', 'e'])
    expect(ids('   ')).toEqual(['a', 'b', 'c', 'd', 'e'])
  })

  it('이름 일부로 찾는다', () => {
    expect(ids('강당')).toEqual(['a'])
  })

  it('띄어쓰기가 달라도 찾는다', () => {
    expect(ids('어울림강당')).toEqual(['a'])
    expect(ids('물리 치료')).toEqual(['b'])
  })

  it('초성만으로 찾는다', () => {
    expect(ids('ㅁㄹㅊㄹㅅ')).toEqual(['b'])
    expect(ids('ㅎㅈㅅ')).toEqual(['d'])
  })

  it('초성과 완성 글자를 섞어도 찾는다', () => {
    expect(ids('물ㄹㅊ')).toEqual(['b'])
  })

  it('마지막 글자 받침을 치는 중이어도 찾는다', () => {
    expect(ids('어울림 가')).toEqual(['a'])
  })

  it('받침 중간 상태는 마지막 글자에만 허용한다', () => {
    // '가'가 마지막이 아니면 '강'과 맞지 않는다
    expect(ids('가당')).toEqual([])
  })

  it('영문은 대소문자를 가리지 않는다', () => {
    expect(ids('it')).toEqual(['e'])
  })

  it('이름으로 시작하는 것 > 이름에 포함 > 구분에만 맞는 것 순서', () => {
    // '건강교실'은 이름이 '건강'으로 시작, '물리치료실'은 구분이 '건강'
    expect(ids('건강')).toEqual(['c', 'b'])
    // 'ㄱ' 은 '건강교실'(시작) → '어울림 강당'(중간) 순, 구분만 맞는 건 그 뒤
    expect(ids('ㄱ').slice(0, 2)).toEqual(['c', 'a'])
  })

  it('구분(카테고리)으로도 찾는다', () => {
    expect(ids('편의')).toEqual(['d'])
  })

  it('없는 이름은 빈 목록', () => {
    expect(ids('수영장')).toEqual([])
  })
})

describe('scoreText', () => {
  it('안 맞으면 0', () => {
    expect(scoreText('화장실', 'ㄱ')).toBe(0)
  })
})
