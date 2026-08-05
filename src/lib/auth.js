// Custom auth — Google OAuth via API Worker, custom JWT
// Tidak ada Supabase.

const API = (import.meta.env.VITE_WORKER_URL || '').replace(/\/$/, '');
const ACCESS_KEY  = 'mf_at';   // access token
const REFRESH_KEY = 'mf_rt';   // refresh token

// ── Token storage ─────────────────────────────────────────────
export function getStoredToken()   { return localStorage.getItem(ACCESS_KEY);  }
export function getRefreshToken()  { return localStorage.getItem(REFRESH_KEY); }

function storeTokens(accessToken, refreshToken) {
  localStorage.setItem(ACCESS_KEY, accessToken);
  if (refreshToken) localStorage.setItem(REFRESH_KEY, refreshToken);
}

export function clearAuth() {
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
}

// ── JWT helpers ───────────────────────────────────────────────
export function parseJWT(token) {
  try {
    const b64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(b64));
  } catch { return null; }
}

function isValid(token) {
  if (!token) return false;
  const p = parseJWT(token);
  return p && p.exp > Math.floor(Date.now() / 1000) + 30; // 30s buffer
}

// ── Get access token (auto-refresh si expired) ────────────────
let refreshPromise = null; // deduplicate concurrent refresh calls

export async function getAccessToken(forceRefresh = false) {
  const token = getStoredToken();
  if (!forceRefresh && isValid(token)) return token;

  if (!refreshPromise) {
    refreshPromise = (async () => {
      const rt = getRefreshToken();
      if (!rt) { clearAuth(); return null; }
      try {
        const res = await fetch(`${API}/api/auth/refresh`, {
          method:      'POST',
          headers:     { 'Content-Type': 'application/json' },
          body:        JSON.stringify({ refresh_token: rt }),
          credentials: 'include', // wajib supaya cookie img_session ikut terkirim & backfill Set-Cookie diterima
        });
        if (!res.ok) { clearAuth(); return null; }
        const { access_token, refresh_token } = await res.json();
        storeTokens(access_token, refresh_token);
        return access_token;
      } catch { return null; }
      finally   { refreshPromise = null; }
    })();
  }
  return refreshPromise;
}

// ── Current user (dari JWT payload) ──────────────────────────
export function getCurrentUser() {
  const token = getStoredToken();
  if (!isValid(token)) return null;
  const p = parseJWT(token);
  return p ? { id: p.sub, email: p.email, name: p.name, avatar: p.avatar } : null;
}

// ── Login via Google OAuth ────────────────────────────────────
// Opsional kirim token Turnstile (?ts=) — worker verifikasi sebelum redirect ke Google.
export function loginWithGoogle(turnstileToken) {
  const redirect = window.location.href;
  const ts = turnstileToken ? `&ts=${encodeURIComponent(turnstileToken)}` : '';
  window.location.href = `${API}/api/auth/google?redirect=${encodeURIComponent(redirect)}${ts}`;
}

// ── Exchange one-time login code for tokens ───────────────────
export async function exchangeLoginCode(code) {
  const res = await fetch(`${API}/api/auth/exchange`, {
    method:      'POST',
    headers:     { 'Content-Type': 'application/json' },
    body:        JSON.stringify({ code }),
    credentials: 'include', // wajib supaya Set-Cookie img_session (cross-subdomain) diterima
  });
  if (!res.ok) return null;
  const data = await res.json();
  storeTokens(data.access_token, data.refresh_token);
  return data.user
    ? { id: data.user.id, email: data.user.email, name: data.user.name, avatar: data.user.avatar }
    : getCurrentUser();
}

// ── Logout ────────────────────────────────────────────────────
export async function logout() {
  const rt = getRefreshToken();
  clearAuth();
  if (rt) {
    try {
      await fetch(`${API}/api/auth/logout`, {
        method:      'POST',
        headers:     { 'Content-Type': 'application/json' },
        body:        JSON.stringify({ refresh_token: rt }),
        credentials: 'include', // wajib supaya cookie img_session ikut terkirim & terhapus
      });
    } catch {}
  }
}
