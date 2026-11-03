import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base:'./' — 빌드 결과(dist/)를 어느 경로에 두더라도(파일로 직접 열어도) 자산을 찾도록 상대 경로로 만든다.
export default defineConfig({
  plugins: [react()],
  base: './',
  server: { port: 5174, strictPort: true },
})
