import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Lock, Check, Crown } from 'lucide-react';
import { loginWithGoogle } from '../lib/auth';
import { loadTurnstile, TURNSTILE_SITEKEY } from '../lib/session';
import { imgUrl } from '../utils';

const TRAKTEER_URL = 'https://trakteer.id/NuranantoScanlation';
const SUPPORTER_MIN = 'Rp 5.000';

// Widget Turnstile terlihat (centang) untuk gate login.
function LoginTurnstile({ onToken }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!TURNSTILE_SITEKEY) { onToken(''); return; }
    let widgetId;
    let cancelled = false;
    loadTurnstile().then((ts) => {
      if (cancelled || !ts || !ref.current) return;
      try {
        widgetId = ts.render(ref.current, {
          sitekey: TURNSTILE_SITEKEY,
          callback: (t) => onToken(t),
          'error-callback': () => {},
          'timeout-callback': () => {},
        });
      } catch {}
    });
    return () => {
      cancelled = true;
      try { if (widgetId != null && window.turnstile) window.turnstile.remove(widgetId); } catch {}
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return <div ref={ref} className="flex justify-center min-h-[65px]" />;
}

// ── Auth Modal — Google OAuth ─────────────────────────────────
const AUTH_COPY = {
  unlock: {
    title: 'Masuk untuk lanjut',
    subtitle: 'Login sebentar — Supporter bisa langsung baca chapter Early Access.',
  },
  reader: {
    title: 'Masuk untuk lanjut',
    subtitle: 'Kamu akan kembali ke halaman yang sama setelah masuk.',
  },
  default: {
    title: 'Selamat Datang',
    subtitle: 'Masuk untuk akses Supporter & riwayat baca.',
  },
};

const AUTH_BENEFITS = [
  'Lanjut baca dari halaman terakhir',
  'Akses chapter Early Access sebagai Supporter',
  'Dukung rilis chapter berikutnya',
];

export function AuthModal({ isOpen, onClose, reason }) {
  const [verifying, setVerifying] = useState(false);
  const [redirecting, setRedirecting] = useState(false);
  useEffect(() => {
    if (isOpen) return;
    const timer = setTimeout(() => {
      setVerifying(false);
      setRedirecting(false);
    }, 0);
    return () => clearTimeout(timer);
  }, [isOpen]);
  if (!isOpen) return null;
  const copy = AUTH_COPY[reason] || AUTH_COPY.default;
  const handleToken = (token) => {
    setRedirecting(true);
    loginWithGoogle(token || undefined);
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[400] flex items-center justify-center bg-black/75 backdrop-blur-md px-4">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={onClose} className="absolute inset-0" />

        <motion.div
          initial={{ opacity: 0, scale: 0.92, y: 24 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.92, y: 24 }}
          transition={{ type: 'spring', damping: 22, stiffness: 300 }}
          className="relative w-full max-w-sm bg-surface-container border border-white/10 rounded-3xl shadow-2xl overflow-hidden z-10"
        >
          <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent pointer-events-none" />
          <div className="absolute -top-16 left-1/2 -translate-x-1/2 w-64 h-64 bg-primary/10 rounded-full blur-3xl pointer-events-none" />

          <button onClick={onClose}
            className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-outline cursor-pointer z-10 transition-colors">
            <X className="w-4 h-4" />
          </button>

          <div className="relative px-7 pt-6 sm:pt-9 pb-7 flex flex-col items-center gap-5">
            <div className="flex flex-col items-center gap-3">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-sky-400/20 to-indigo-600/20 border border-white/10 flex items-center justify-center shadow-lg overflow-hidden p-2">
                <img src="/icon.webp" alt="Logo" className="w-full h-full object-contain" />
              </div>
              <div className="text-center">
                <h3 className="text-xl font-black text-on-surface">{copy.title}</h3>
                <p className="text-xs text-outline/70 mt-1 leading-relaxed max-w-[16rem] mx-auto">{copy.subtitle}</p>
              </div>
            </div>

            <div className="w-full flex flex-col gap-2 px-1">
              {AUTH_BENEFITS.map((t) => (
                <div key={t} className="flex items-center gap-2.5 text-xs text-outline">
                  <Check className="w-4 h-4 text-primary shrink-0" />
                  <span>{t}</span>
                </div>
              ))}
            </div>

            {!verifying ? (
              <button onClick={() => setVerifying(true)}
                className="w-full h-13 py-3.5 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 flex items-center justify-center gap-3 text-sm font-bold text-on-surface cursor-pointer active:scale-[0.97] transition-all group">
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                </svg>
                Lanjutkan dengan Google
              </button>
            ) : redirecting ? (
              <div className="w-full h-13 flex items-center justify-center gap-2.5 text-sm font-bold text-on-surface">
                <div className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                Mengarahkan ke Google…
              </div>
            ) : (
              <div className="w-full flex flex-col items-center gap-2.5">
                <p className="text-xs text-outline/80">Selesaikan verifikasi untuk lanjut</p>
                <LoginTurnstile onToken={handleToken} />
              </div>
            )}

            <p className="text-center text-[10px] text-outline/40 leading-relaxed">
              Akun hanya bisa aktif di satu perangkat. Dengan masuk, kamu menyetujui syarat &amp; ketentuan layanan kami.
            </p>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

// ── Supporter Modal — ajakan jadi Supporter via Trakteer ──────
// Donasi >= Rp 5.000 → akses semua chapter terkunci selama 30 hari.
export function SupporterModal({ isOpen, onClose, userEmail }) {
  if (!isOpen) return null;
  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[400] flex items-center justify-center bg-black/75 backdrop-blur-md px-4">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={onClose} className="absolute inset-0" />

        <motion.div initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          className="relative w-full max-w-sm bg-surface-container border border-white/10 rounded-2xl shadow-2xl z-10 overflow-hidden"
        >
          <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-72 h-72 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="overflow-y-auto hide-scrollbar max-h-[90vh] p-6 flex flex-col gap-5">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-base font-black text-on-surface flex items-center gap-2">
                  <Crown className="w-5 h-5 text-amber-400 fill-current" />
                  Jadi Supporter
                </h3>
                <p className="text-xs text-outline mt-0.5">Buka chapter Early Access</p>
              </div>
              <button onClick={onClose}
                className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-outline cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Benefit */}
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-3 flex flex-col gap-2">
              <div className="flex items-center gap-2 text-sm font-black text-amber-300">
                <Check className="w-4 h-4 shrink-0" /> Akses SEMUA chapter Early Access
              </div>
              <div className="flex items-center gap-2 text-sm font-black text-amber-300">
                <Check className="w-4 h-4 shrink-0" /> Aktif 30 hari sejak donasi
              </div>
              <p className="text-[11px] text-outline/70 leading-relaxed">
                Cukup donasi minimal <strong className="text-on-surface">{SUPPORTER_MIN}</strong> di Trakteer. Status Supporter otomatis aktif setelah donasi dikonfirmasi.
              </p>
            </div>

            {/* Mockup Trakteer — tunjukkan email di kolom Pesan & jangan dijadikan private */}
            <div className="border border-white/10 rounded-xl overflow-hidden bg-[#1a1a2e]">
              <div className="px-3 py-2 border-b border-white/5 flex items-center gap-2">
                <div className="w-5 h-5 rounded-full bg-sky-500/30 flex items-center justify-center text-[8px] font-black text-sky-300">N</div>
                <div>
                  <p className="text-[10px] font-black text-white/80">Nurananto Scanlation</p>
                  <p className="text-[9px] text-white/40">@NuranantoScanlation</p>
                </div>
              </div>
              <div className="p-3 flex flex-col gap-2">
                <div className="bg-white/5 rounded-lg p-2.5">
                  <p className="text-[9px] text-white/40 mb-1">Pesan</p>
                  <p className="text-[10px] font-bold text-amber-300 break-all">{userEmail || 'email@kamu.com'}</p>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded border border-white/20 flex items-center justify-center bg-white/5">
                    <div className="w-1.5 h-1.5 rounded-[1px] bg-red-400" />
                  </div>
                  <p className="text-[9px] text-red-400 line-through">Jadikan pesan private</p>
                  <span className="text-[9px] text-white/40">← jangan!</span>
                </div>
              </div>
            </div>

            {/* Cara donasi */}
            <div className="flex flex-col gap-2">
              <p className="text-[10px] font-black text-outline uppercase tracking-wider">Cara jadi Supporter</p>
              {[
                { n: 1, text: 'Klik tombol di bawah → buka halaman Trakteer' },
                { n: 2, text: <>Isi kolom <strong className="text-on-surface">Pesan</strong> dengan email akunmu: <span className="text-amber-300 font-bold break-all">{userEmail || '—'}</span></> },
                { n: 3, text: <><strong className="text-red-400">Jangan</strong> centang "Jadikan pesan private"</> },
                { n: 4, text: <>Donasi minimal <strong className="text-on-surface">{SUPPORTER_MIN}</strong>, lalu bayar</> },
                { n: 5, text: 'Status Supporter aktif otomatis setelah donasi dikonfirmasi (30 hari)' },
              ].map(({ n, text }) => (
                <div key={n} className="flex gap-2.5 items-start">
                  <span className="w-4 h-4 rounded-full bg-amber-500/20 border border-amber-500/30 text-amber-400 text-[9px] font-black flex items-center justify-center shrink-0 mt-0.5">{n}</span>
                  <p className="text-[11px] text-outline/80 leading-relaxed">{text}</p>
                </div>
              ))}
            </div>

            <a href={TRAKTEER_URL} target="_blank" rel="noopener noreferrer"
              className="w-full h-12 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-black text-sm flex items-center justify-center gap-2 transition-all active:scale-[0.98] cursor-pointer">
              <Crown className="w-4 h-4 fill-current" />
              Dukung via Trakteer
            </a>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

// ── Account Settings Modal — username + email ─────────────────
export function AccountSettingsModal({ isOpen, onClose, currentUser, nameChangedAt, onSave }) {
  const [username, setUsername] = useState(currentUser?.name || '');
  const [trakteerEmail, setTrakteerEmail] = useState(currentUser?.email || '');
  const [loading, setLoading] = useState(false);
  const [emailError, setEmailError] = useState('');

  const nameLockedUntil = (() => {
    if (!nameChangedAt) return null;
    const until = new Date(new Date(nameChangedAt).getTime() + 365 * 24 * 60 * 60 * 1000);
    return until > new Date() ? until : null;
  })();

  const handleSave = async (e) => {
    e.preventDefault();
    if (!trakteerEmail) { setEmailError('Email wajib diisi.'); return; }
    setLoading(true);
    await onSave({ username: nameLockedUntil ? null : username, trakteerEmail });
    setLoading(false);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[400] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={onClose} className="absolute inset-0" />
        <motion.div initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          className="relative w-full max-w-sm bg-surface-container border border-white/10 rounded-2xl shadow-2xl p-6 z-10"
        >
          <div className="flex justify-between items-center mb-5">
            <h3 className="text-base font-black text-on-surface">Pengaturan Akun</h3>
            <button onClick={onClose}
              className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-outline cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          </div>

          <form onSubmit={handleSave} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-black text-outline uppercase tracking-wider">Username</label>
              <input
                type="text"
                placeholder="Nama tampilan kamu"
                value={username}
                onChange={e => !nameLockedUntil && setUsername(e.target.value)}
                disabled={!!nameLockedUntil}
                className={`w-full bg-surface-container-high border rounded-xl px-4 py-3 text-sm text-on-surface placeholder:text-outline focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all ${nameLockedUntil ? 'opacity-50 cursor-not-allowed border-white/5' : 'border-white/5'}`}
              />
              {nameLockedUntil ? (
                <p className="text-[10px] text-amber-400/80">
                  Bisa diganti lagi pada {nameLockedUntil.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                </p>
              ) : (
                <p className="text-[10px] text-outline/60">Nama tampilan di komentar. Hanya bisa diganti setahun sekali.</p>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-black text-outline uppercase tracking-wider">
                Email <span className="text-red-400">*</span>
              </label>
              <input
                type="email"
                required
                placeholder="email@contoh.com"
                value={trakteerEmail}
                onChange={e => { setTrakteerEmail(e.target.value); setEmailError(''); }}
                className={`w-full bg-surface-container-high border rounded-xl px-4 py-3 text-sm text-on-surface placeholder:text-outline focus:outline-none focus:ring-2 transition-all ${emailError ? 'border-red-500/50 focus:border-red-500 focus:ring-red-500/20' : 'border-white/5 focus:border-amber-400 focus:ring-amber-400/20'}`}
              />
              {emailError
                ? <p className="text-[10px] text-red-400">{emailError}</p>
                : <p className="text-[10px] text-outline/60">Patokan pencocokan donasi Supporter. Pastikan sama dengan email donasi Trakteer kamu.</p>
              }
            </div>

            <div className="flex gap-3 mt-1">
              <button type="button" onClick={onClose}
                className="flex-1 h-11 rounded-xl border border-white/10 text-xs font-bold text-outline hover:bg-white/5 cursor-pointer transition-colors">
                Batal
              </button>
              <button type="submit" disabled={loading}
                className="flex-1 h-11 rounded-xl bg-gradient-to-r from-sky-400 to-indigo-600 hover:from-sky-500 hover:to-indigo-700 text-white text-xs font-black cursor-pointer transition-all disabled:opacity-50 active:scale-[0.98]">
                {loading ? 'Menyimpan...' : 'Simpan'}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

// ── Locked Chapter Modal — gate Supporter ─────────────────────
export function LockedChapterModal({ isOpen, onClose, chapter, manga, isLoggedIn, isSupporter, onLogin, onBecomeSupporter }) {
  if (!isOpen || !chapter || isSupporter) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/80 backdrop-blur-md px-4">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={onClose} className="absolute inset-0" />
        <motion.div
          initial={{ opacity: 0, scale: 0.93, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.93, y: 20 }}
          transition={{ type: 'spring', damping: 22, stiffness: 320 }}
          className="relative w-full max-w-sm sm:max-w-md md:max-w-lg bg-surface-container border border-white/10 rounded-2xl shadow-2xl overflow-hidden z-10"
        >
          <div className="absolute -top-16 left-1/2 -translate-x-1/2 w-64 h-48 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
          <button onClick={onClose}
            className="absolute top-4 right-4 w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-white/5 hover:bg-white/15 flex items-center justify-center text-outline cursor-pointer z-10 transition-colors">
            <X className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
          <div className="flex items-start gap-3 p-5 pb-4 pr-14 sm:pr-16">
            {manga?.coverUrl && (
              <img src={imgUrl(manga.coverUrl)} alt=""
                className="w-[52px] sm:w-[60px] aspect-[2/3] object-cover rounded-lg border border-white/15 shrink-0 shadow-lg" />
            )}
            <div className="min-w-0 pt-0.5">
              <div className="flex items-center gap-1.5 mb-1">
                <Lock className="w-4 h-4 sm:w-5 sm:h-5 text-amber-400 shrink-0" />
                <span className="font-label-sm text-xs sm:text-sm md:text-base font-black text-amber-400 uppercase tracking-wider">Early Access</span>
              </div>
              <p className="font-body-md text-sm sm:text-base text-outline/70 font-semibold truncate">{manga?.title || ''}</p>
              <h3 className="font-headline-md text-base sm:text-lg md:text-xl font-black text-on-surface mt-0.5 line-clamp-2">{chapter.title}</h3>
            </div>
          </div>
          {chapter.unlockDate && (
            <div className="mx-5 mb-5 bg-surface-container-high/40 rounded-xl py-4 px-4 border border-white/5 flex flex-col items-center gap-2 text-center">
              <p className="font-label-sm text-xs sm:text-sm md:text-base text-amber-400 font-black uppercase tracking-widest">Chapter Early Access</p>
              <p className="font-body-md text-sm sm:text-base text-outline/80 font-semibold leading-relaxed">
                Akan bisa diakses setelah masa early access selesai.
              </p>
            </div>
          )}
          <div className="px-5 pb-5 flex flex-col gap-2">
            {!isLoggedIn ? (
              <button onClick={onLogin}
                className="w-full h-12 sm:h-14 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-black text-sm sm:text-base md:text-lg flex items-center justify-center gap-2 active:scale-[0.97] transition-all cursor-pointer shadow-lg shadow-amber-900/30">
                <Crown className="w-4 h-4 sm:w-5 sm:h-5 fill-current" />
                Login untuk membaca Early Access
              </button>
            ) : (
              <button onClick={onBecomeSupporter}
                className="w-full h-12 sm:h-14 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-black text-sm sm:text-base md:text-lg flex items-center justify-center gap-2 active:scale-[0.97] transition-all cursor-pointer shadow-lg shadow-amber-900/30">
                <Crown className="w-4 h-4 sm:w-5 sm:h-5 fill-current" />
                {isSupporter ? 'Perpanjang Supporter' : 'Jadi Supporter untuk membaca Early Access'}
              </button>
            )}
            <button onClick={onClose}
              className="w-full h-10 sm:h-12 rounded-xl border border-white/10 text-xs sm:text-sm md:text-base font-bold text-outline hover:text-on-surface hover:bg-white/5 transition-all cursor-pointer">
              Tutup
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
