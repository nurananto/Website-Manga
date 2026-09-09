import { useState } from 'react';
import { imgUrl } from '../utils';

const MAX_RETRIES = 2;
const RETRY_DELAY_MS = [400, 1200]; // backoff per percobaan

// Kadang <img> cover gagal muat sesaat (network blip, race pas banyak cover
// diminta bareng — mis. ganti halaman pagination) — tanpa retry, begitu gagal
// sekali dia nyangkut kosong/hitam (cuma keliatan bg-surface-container-high
// di baliknya) sampai user refresh manual. Retry otomatis dengan query param
// pembeda (bukan re-request URL identik yang bisa kena cache negatif yang
// sama) sebelum benar-benar menyerah.
// variant="thumb" — kartu grid kecil (MangaCard/MangaCardGrid, tampil
// ~96-150px lebar) BUKAN hero/detail. Beda dari mobile/tablet/desktop yang
// dipilih lewat media query VIEWPORT (<picture><source>), thumb dibutuhkan
// di SEMUA lebar layar (kartu kecil tetap kecil walau di desktop) — jadi
// langsung dipatok ke coverUrls.thumb (400px), skip <source> sama sekali.
// Sebelumnya kartu-kartu ini ikut coverUrls.mobile (640px, didesain utk
// hero) — 5-7x lebih besar dari kebutuhan aslinya.
export default function ResponsiveCover({ manga, alt = '', className = '', variant, ...imgProps }) {
  const covers = manga?.coverUrls;
  const desktopUrl = imgUrl(covers?.desktop || manga?.coverUrl);
  const mobileUrl = covers?.mobile ? imgUrl(covers.mobile) : null;
  const isThumb = variant === 'thumb';
  const base = isThumb ? (covers?.thumb ? imgUrl(covers.thumb) : (mobileUrl || desktopUrl)) : desktopUrl;
  const mobileBase = isThumb ? null : mobileUrl;
  const tabletBase = isThumb ? null : (covers?.tablet ? imgUrl(covers.tablet) : null);

  // Reset retry + loaded sinkron pas render (bukan lewat effect) begitu cover
  // beda — pola resmi React utk "derive state dari perubahan prop" tanpa
  // render ekstra yang dipicu effect. Lihat react.dev/you-might-not-need-an-effect.
  const [state, setState] = useState({ base, retry: 0, loaded: false });
  if (state.base !== base) setState({ base, retry: 0, loaded: false });
  const { retry, loaded } = state;

  const withRetry = (url) => {
    if (!url || retry === 0) return url;
    return url + (url.includes('?') ? '&' : '?') + '_r=' + retry;
  };

  const handleError = () => {
    if (retry >= MAX_RETRIES) return;
    const delay = RETRY_DELAY_MS[retry] || RETRY_DELAY_MS[RETRY_DELAY_MS.length - 1];
    setTimeout(() => setState((s) => (s.base === base ? { ...s, retry: s.retry + 1 } : s)), delay);
  };

  // Bukan cover-nya lambat/gagal — cuma banyak gambar diminta bareng (carousel
  // + grid kartu bisa puluhan sekaligus) jadi wajar ada yang antre beberapa
  // detik (dikonfirmasi lewat DevTools: request-nya normal, cuma pending).
  // Sebelumnya kotak antrean itu diam gelap polos, kesannya kayak rusak.
  // Shimmer ini cuma sinyal visual "lagi dimuat", tidak menambah/mengubah
  // request apa pun.
  const handleLoad = () => setState((s) => (s.base === base ? { ...s, loaded: true } : s));

  return (
    // key={retry} — sengaja remount UTUH <picture>+<source>+<img> tiap retry,
    // bukan cuma update atribut srcSet. Sekadar mengganti srcSet pada <source>
    // yang sudah ter-render TIDAK selalu memaksa browser mengulang request
    // (beda dgn <img src> polos) — ini kemungkinan penyebab cover yang
    // "nyangkut blank" walau retry logic di atas sudah jalan (state berubah,
    // tapi browser diam-diam gak benar-benar retry). key baru = elemen DOM
    // baru = browser pasti fetch ulang dari nol.
    <picture key={retry} className="contents">
      {mobileBase && <source media="(max-width: 639px)" srcSet={withRetry(mobileBase)} />}
      {tabletBase && <source media="(max-width: 1023px)" srcSet={withRetry(tabletBase)} />}
      <img
        {...imgProps}
        src={withRetry(base)}
        alt={alt}
        className={`${className} ${loaded ? '' : 'cover-loading-shimmer'}`}
        onLoad={handleLoad}
        onError={handleError}
      />
    </picture>
  );
}
