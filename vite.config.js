import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  build: {
    rollupOptions: {
      output: {
        // Pisahkan dependency besar jadi chunk vendor sendiri. Kode vendor jarang
        // berubah, jadi tetap ter-cache lintas deploy (yang sering: sync-covers/viewcounts)
        // — returning visitor hanya unduh ulang chunk app, bukan ~123KB vendor.
        manualChunks(id) {
          if (!id.includes('node_modules')) return
          if (id.includes('@heroui')) return 'heroui'
          if (id.includes('framer-motion')) return 'framer'
          if (id.includes('lucide-react')) return 'icons'
          if (id.includes('/react-dom/') || id.includes('/react/') || id.includes('/scheduler/')) return 'react'
          return 'vendor'
        },
      },
    },
  },
})
