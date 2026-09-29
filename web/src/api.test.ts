import { afterEach, describe, expect, it, vi } from 'vitest'
import { request } from './api'

afterEach(() => vi.unstubAllGlobals())

describe('API 요청', () => {
  it('직원 비밀번호를 직원 API 에만 보낸다', async () => {
    const key = crypto.randomUUID()
    const fetchMock = vi.fn(async (_url: string, _options: RequestInit) => new Response('{}', { status: 200 }))
    vi.stubGlobal('window', { setTimeout, clearTimeout })
    vi.stubGlobal('sessionStorage', { getItem: () => key })
    vi.stubGlobal('fetch', fetchMock)

    await request('/snapshot')
    await request('/attendance/demo', 'POST', {})
    await request('/admin/catalog')

    const headers = fetchMock.mock.calls.map(([, options]) => options.headers as Record<string, string>)
    expect(headers[0]?.['X-Admin-Key']).toBeUndefined()
    expect(headers[1]?.['X-Admin-Key']).toBeUndefined()
    expect(headers[2]?.['X-Admin-Key']).toBe(key)
  })

  it('429 대기 시간을 직원에게 알려준다', async () => {
    vi.stubGlobal('window', { setTimeout, clearTimeout })
    vi.stubGlobal('sessionStorage', { getItem: () => '' })
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ detail: '잠시 후 다시 시도해 주세요.' }), {
      status: 429, headers: { 'Content-Type': 'application/json', 'Retry-After': '17' },
    })))

    await expect(request('/admin/catalog')).rejects.toMatchObject({
      status: 429,
      retryAfter: 17,
      message: '시도가 많습니다. 17초 후 다시 입력해 주세요.',
    })
  })
})
