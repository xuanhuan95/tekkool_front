import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: { host: true, port: 3000 },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.ts',
    // 3 file .test.js cũ chạy bằng `node`, không có describe/it — vitest nạp
    // vào sẽ báo "no test suite". Chúng vẫn tự chạy được, cứ để yên cho tới
    // khi chuyển sang .test.ts.
    exclude: ['**/node_modules/**', '**/dist/**', '**/build/**',
              'src/components/Passage.test.js',
              'src/pages/dashboard/subjectStyle.test.js',
              'src/pages/exam-creation/convertData.test.js'],
  },
})
