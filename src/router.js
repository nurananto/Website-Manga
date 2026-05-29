// Simple path-based router
// /              → { page: 'home' }
// /waka-chan      → { page: 'manga', mangaId: 'waka-chan' }
// /waka-chan/35   → { page: 'reader', mangaId: 'waka-chan', chapterNum: '35' }

export function parsePath(pathname = window.location.pathname) {
  const parts = pathname.replace(/^\//, '').split('/').filter(Boolean);
  if (parts.length === 0) return { page: 'home' };
  if (parts.length === 1) return { page: 'manga', mangaId: parts[0] };
  if (parts.length >= 2) return { page: 'reader', mangaId: parts[0], chapterNum: parts[1] };
  return { page: 'home' };
}

export function navigate(path, replace = false) {
  if (replace) {
    window.history.replaceState(null, '', path);
  } else {
    window.history.pushState(null, '', path);
  }
  window.dispatchEvent(new PopStateEvent('popstate'));
}
