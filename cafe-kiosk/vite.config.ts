import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

/**
 * 빌드 결과(dist/index.html)를 파일 더블클릭(file://)으로 열어도 동작하게 한다.
 * 크롬은 file:// 에서 type="module" 스크립트와 crossorigin 이 붙은 자원을 막아 화면이 하얗게 나온다.
 * 그래서 번들을 IIFE(일반 스크립트)로 만들고, index.html 의 module · crossorigin 표시를 뗀다.
 * 빌드에만 적용한다. 개발 서버(npm run dev)는 원래대로 모듈을 쓴다.
 */
function fileProtocolFriendly(): Plugin {
  return {
    name: 'file-protocol-friendly',
    apply: 'build',
    enforce: 'post',
    transformIndexHtml(html) {
      return html
        .replace(/<script type="module" crossorigin src=/g, '<script defer src=')
        .replace(/ crossorigin(?=[ >])/g, '')
    },
  }
}

// base:'./' — 빌드 결과(dist/)를 어느 경로에 두더라도 자산을 찾도록 상대 경로로 만든다.
export default defineConfig({
  plugins: [react(), fileProtocolFriendly()],
  base: './',
  build: {
    modulePreload: false,
    rollupOptions: { output: { format: 'iife' } },
  },
  server: { port: 5174, strictPort: true },
})
