// Simple path-based router
// /              → { page: 'home' }
// /history       → { page: 'history' }
// /waka-chan      → { page: 'manga', mangaId: 'waka-chan' }
// /waka-chan/35   → { page: 'reader', mangaId: 'waka-chan', chapterNum: '35' }

const RESERVED = new Set(['history', 'auth']);

export function parsePath(pathname = window.location.pathname) {
  const parts = pathname.replace(/^\//, '').split('/').filter(Boolean);
  if (parts.length === 0) return { page: 'home' };
  if (parts.length === 1 && RESERVED.has(parts[0])) return { page: parts[0] };
  if (parts.length === 1) return { page: 'manga', mangaId: parts[0] };
  if (parts.length >= 2) return { page: 'reader', mangaId: parts[0], chapterNum: parts[1] };
  return { page: 'home' };
}

export function navigate(path, replace = false) {
  const currentState = window.history.state && typeof window.history.state === 'object'
    ? window.history.state
    : {};
  window.history.replaceState({ ...currentState, scrollY: window.scrollY }, '', window.location.href);
  const nextState = { scrollY: 0, from: window.location.pathname };
  if (replace) {
    window.history.replaceState(nextState, '', path);
  } else {
    window.history.pushState(nextState, '', path);
  }
  window.dispatchEvent(new PopStateEvent('popstate', { state: nextState }));
}
