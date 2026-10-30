import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ mode }) => {
  const frappeBuild = mode === 'frappe'

  return {
    base: frappeBuild ? '/assets/mmel_customer_portal/customer_portal/' : '/',
    plugins: [react(), tailwindcss()],
    build: frappeBuild ? {
      outDir: 'mmel_customer_portal/public/customer_portal',
      emptyOutDir: true,
    } : undefined,
    server: {
      host: '127.0.0.1',
      port: 4173,
      proxy: {
        '/api': {
          // Use the public ERPNext host when developing outside the office network.
          // The installed Frappe app uses same-origin /api routes.
          target: 'https://moneygram.advtinni.com',
          changeOrigin: true,
          secure: false,
          cookieDomainRewrite: '',
        },
      },
    },
  }
})
