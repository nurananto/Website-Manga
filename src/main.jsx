import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Self-hosted fonts — no Google Fonts dependency, no FOUT on reload
import '@fontsource/inter/latin-300.css'
import '@fontsource/inter/latin-400.css'
import '@fontsource/inter/latin-500.css'
import '@fontsource/hanken-grotesk/latin-300.css'
import '@fontsource/hanken-grotesk/latin-400.css'
import '@fontsource/hanken-grotesk/latin-700.css'
import '@fontsource/geist/latin-500.css'

window.addEventListener('vite:preloadError', (event) => {
  event.preventDefault()
  const key = 'mf-preload-reload'
  try {
    if (sessionStorage.getItem(key)) return
    sessionStorage.setItem(key, '1')
  } catch {}
  const next = new URL(window.location.href)
  next.searchParams.set('r', Date.now().toString())
  window.location.replace(next.toString())
})

// Register Service Worker — auto-update di latar belakang.
// Deteksi versi & reload pintar ditangani poll version.json di App.jsx,
// jadi SW di sini cukup di-refresh saat tab kembali aktif (tanpa jalur
// notifikasi terpisah yang redundan).
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').then(reg => {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') reg.update();
    });
  }).catch(() => {});
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
