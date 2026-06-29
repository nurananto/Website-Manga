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
          const normalizedId = id.replace(/\\/g, '/')
          if (!normalizedId.includes('node_modules')) return
          if (
            /node_modules\/(?:\.vite\/deps\/)?react(?:\/|\.js|$)/.test(normalizedId) ||
            /node_modules\/(?:\.vite\/deps\/)?react-dom(?:\/|\.js|$)/.test(normalizedId) ||
            /node_modules\/(?:\.vite\/deps\/)?scheduler(?:\/|\.js|$)/.test(normalizedId)
          ) return 'react'
          if (normalizedId.includes('@heroui')) return 'heroui'
          if (normalizedId.includes('lucide-react')) return 'icons'
        },
      },
    },
  },
})
