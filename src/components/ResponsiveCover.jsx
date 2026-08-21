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
export default function ResponsiveCover({ manga, alt = '', className = '', ...imgProps }) {
  const covers = manga?.coverUrls;
  const base = imgUrl(covers?.desktop || manga?.coverUrl);
  const mobileBase = covers?.mobile ? imgUrl(covers.mobile) : null;
  const tabletBase = covers?.tablet ? imgUrl(covers.tablet) : null;

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
    <picture className="contents">
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
