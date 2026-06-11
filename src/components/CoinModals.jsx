import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Coins, Shield, CheckCircle2, AlertCircle, Clock, Lock } from 'lucide-react';
import { loginWithGoogle } from '../lib/auth';
import { imgUrl } from '../utils';

function CountdownBox({ unlockDate }) {
  const [time, setTime] = useState({ h: 0, m: 0, s: 0 });

  useEffect(() => {
    const update = () => {
      const diff = new Date(unlockDate).getTime() - Date.now();
      if (diff <= 0) { setTime({ h: 0, m: 0, s: 0 }); return; }
      const t = Math.floor(diff / 1000);
      setTime({ h: Math.floor(t / 3600), m: Math.floor((t % 3600) / 60), s: t % 60 });
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [unlockDate]);

  const pad = (n) => String(n).padStart(2, '0');

  return (
    <div className="flex items-end gap-2 justify-center">
      {[{ v: time.h, l: 'JAM' }, { v: time.m, l: 'MENIT' }, { v: time.s, l: 'DETIK' }].reduce((acc, { v, l }, i) => {
        const cell = (
          <div key={l} className="flex flex-col items-center">
            <span className="font-mono text-4xl sm:text-5xl font-black text-on-surface tabular-nums leading-none">{pad(v)}</span>
            <span className="font-label-sm text-[10px] sm:text-xs md:text-sm text-outline/50 font-bold uppercase tracking-widest mt-1">{l}</span>
          </div>
        );
        if (i === 0) return [cell];
        return [...acc, <span key={`s${i}`} className="font-mono text-3xl font-black text-outline/30 pb-5">:</span>, cell];
      }, [])}
    </div>
  );
}

// ── Auth Modal — Google OAuth ─────────────────────────────────
export function AuthModal({ isOpen, onClose }) {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[400] flex items-center justify-center bg-black/75 backdrop-blur-md px-4">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={onClose} className="absolute inset-0" />

        <motion.div initial={{ opacity: 0, scale: 0.92, y: 24 }} animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.92, y: 24 }} transition={{ type: 'spring', damping: 20, stiffness: 300 }}
          className="relative w-full max-w-sm bg-surface-container border border-white/10 rounded-3xl shadow-2xl overflow-hidden z-10"
        >
          {/* Background glow */}
          <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent pointer-events-none" />
          <div className="absolute -top-16 left-1/2 -translate-x-1/2 w-64 h-64 bg-primary/10 rounded-full blur-3xl pointer-events-none" />

          {/* Close */}
          <button onClick={onClose}
            className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-outline cursor-pointer z-10 transition-colors">
            <X className="w-4 h-4" />
          </button>

          <div className="relative px-8 pt-10 pb-8 flex flex-col items-center gap-6">
            {/* Logo/Icon */}
            <div className="flex flex-col items-center gap-3">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-sky-400/20 to-indigo-600/20 border border-white/10 flex items-center justify-center shadow-lg">
                <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" className="text-primary" />
                </svg>
              </div>
              <div className="text-center">
                <h3 className="text-xl font-black text-on-surface">Selamat Datang</h3>
                <p className="text-xs text-outline/70 mt-1">Masuk untuk akses koin &amp; riwayat baca</p>
              </div>
            </div>

            {/* OAuth button */}
            <div className="w-full flex flex-col gap-3">
              <button onClick={loginWithGoogle}
                className="w-full h-13 py-3.5 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 flex items-center justify-center gap-3 text-sm font-bold text-on-surface cursor-pointer active:scale-[0.97] transition-all group">
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                </svg>
                Lanjutkan dengan Google
              </button>
            </div>

            <p className="text-center text-[10px] text-outline/40 leading-relaxed">
              Dengan masuk, kamu menyetujui syarat &amp; ketentuan layanan kami.
            </p>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

// ── Trakteer Email Modal — muncul pertama kali login ──────────
export function TrakteerEmailModal({ isOpen, onClose, onSave, defaultEmail = '' }) {
  const [email, setEmail] = useState(defaultEmail);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Sync defaultEmail saat pertama dibuka
  useState(() => { if (defaultEmail) setEmail(defaultEmail); });

  const handleSave = async (e) => {
    e.preventDefault();
    if (!email) { setError('Email wajib diisi.'); return; }
    setLoading(true);
    await onSave(email);
    setLoading(false);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[400] flex items-center justify-center bg-black/75 backdrop-blur-md px-4">
        <motion.div initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          className="relative w-full max-w-sm bg-surface-container border border-white/10 rounded-2xl shadow-2xl p-6 z-10"
        >
          <div className="flex flex-col gap-5">
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mx-auto mb-3">
                <Coins className="w-6 h-6 text-amber-400" />
              </div>
              <h3 className="text-base font-black text-on-surface">Konfirmasi Email</h3>
              <p className="text-xs text-outline mt-1.5 leading-relaxed">
                Email ini digunakan sebagai identitas akun kamu dan patokan pengiriman koin dari donasi Trakteer. Pastikan sama dengan email yang kamu gunakan saat donasi.
              </p>
            </div>

            {error && (
              <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/25 p-3 rounded-xl text-xs font-bold text-red-400">
                <AlertCircle className="w-4 h-4 shrink-0" /><span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSave} className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-black text-outline uppercase tracking-wider">
                  Email <span className="text-red-400">*</span>
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-outline absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input type="email" placeholder="email@contoh.com" required
                    value={email} onChange={e => { setEmail(e.target.value); setError(''); }}
                    className="w-full bg-surface-container-high border border-white/5 rounded-xl py-3 pl-10 pr-4 text-sm text-on-surface placeholder:text-outline focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20 transition-all"
                  />
                </div>
              </div>

              <button type="submit" disabled={loading}
                className="w-full h-11 rounded-xl bg-gradient-to-r from-amber-400 to-amber-600 hover:from-amber-500 hover:to-amber-700 text-white font-black text-sm transition-all cursor-pointer disabled:opacity-50 active:scale-[0.98]">
                {loading ? 'Menyimpan...' : 'Konfirmasi & Simpan'}
              </button>
            </form>

            <button onClick={onClose}
              className="w-full h-9 rounded-xl border border-white/8 text-xs font-bold text-outline hover:text-on-surface hover:bg-white/5 transition-all cursor-pointer">
              Lewati untuk sekarang
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

// Coin Purchase Modal
export function CoinPurchaseModal({ isOpen, onClose, userCoins, userEmail }) {
  const [step, setStep] = useState(1);
  const rates = [
    { price: 'Rp 2.000',  coins: 20 },
    { price: 'Rp 5.000',  coins: 50, isPopular: true },
    { price: 'Rp 10.000', coins: 100 },
  ];

  const handleClose = () => { setStep(1); onClose(); };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[400] flex items-center justify-center bg-black/75 backdrop-blur-md px-4">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={handleClose} className="absolute inset-0" />

        <motion.div initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          className="relative w-full max-w-sm bg-surface-container border border-white/10 rounded-2xl shadow-2xl z-10 overflow-hidden"
        >
          <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-72 h-72 bg-amber-500/8 rounded-full blur-3xl pointer-events-none" />

          <div className="overflow-y-auto hide-scrollbar max-h-[90vh] p-6 flex flex-col gap-5">

            {/* Header */}
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-base font-black text-on-surface flex items-center gap-2">
                  <Coins className="w-5 h-5 text-amber-400 fill-current" />
                  Isi Koin
                  <span className="text-[10px] font-bold text-outline bg-white/5 px-2 py-0.5 rounded-full">{step}/2</span>
                </h3>
                <p className="text-xs text-outline mt-0.5">
                  {step === 1 ? 'Informasi konversi koin' : 'Cara donasi di Trakteer'}
                </p>
              </div>
              <button onClick={handleClose}
                className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-outline cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Balance */}
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Coins className="w-4 h-4 text-amber-400 fill-current" />
                <span className="text-xs font-bold text-outline uppercase tracking-wider">Koin Saat Ini</span>
              </div>
              <span className="text-lg font-black text-amber-300">{userCoins}</span>
            </div>

            {step === 1 ? (
              <>
                {/* Step 1: Rate table */}
                <div className="flex flex-col gap-2">
                  <p className="text-[10px] font-black text-outline uppercase tracking-wider">Koin yang kamu dapatkan</p>
                  <div className="flex flex-col divide-y divide-white/5 border border-white/8 rounded-xl overflow-hidden">
                    {rates.map(r => (
                      <div key={r.price} className={`flex items-center justify-between px-4 py-3 ${r.isPopular ? 'bg-amber-500/8' : ''}`}>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-black text-on-surface">{r.price}</span>
                          {r.isPopular && <span className="text-[8px] bg-amber-400 text-surface font-black px-1.5 py-0.5 rounded-full uppercase">Populer</span>}
                        </div>
                        <div className="flex items-center gap-1">
                          <Coins className="w-3.5 h-3.5 text-amber-400 fill-current" />
                          <span className="text-sm font-black text-amber-300">{r.coins} koin</span>
                        </div>
                      </div>
                    ))}
                  </div>
                  <p className="text-[10px] text-outline/50 leading-relaxed">
                    Di Trakteer kamu bebas pilih jumlah "Permen" — koin dihitung otomatis dari total nominal yang dikirim.
                  </p>
                </div>

                <button onClick={() => setStep(2)}
                  className="w-full h-11 rounded-xl bg-gradient-to-r from-amber-400 to-amber-600 hover:from-amber-500 hover:to-amber-700 text-white font-black text-sm flex items-center justify-center gap-2 transition-all active:scale-[0.98] cursor-pointer">
                  Lanjut →
                </button>
              </>
            ) : (
              <>
                {/* Step 2: Instructions */}
                <div className="flex flex-col gap-3">
                  <p className="text-[10px] font-black text-outline uppercase tracking-wider">Cara Donasi</p>

                  {/* Mockup Trakteer form */}
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
                        <p className="text-[10px] font-bold text-amber-300">{userEmail || 'email@kamu.com'}</p>
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

                  <div className="flex flex-col gap-2">
                    {[
                      { n: 1, text: 'Klik tombol di bawah → buka halaman Trakteer' },
                      { n: 2, text: <>Isi kolom <strong className="text-on-surface">Pesan</strong> dengan email: <span className="text-amber-300 font-bold break-all">{userEmail || '—'}</span></> },
                      { n: 3, text: <><strong className="text-red-400">Jangan</strong> centang "Jadikan pesan private"</> },
                      { n: 4, text: 'Pilih jumlah Permen sesuai koin yang diinginkan, lalu bayar' },
                      { n: 5, text: 'Koin otomatis masuk setelah donasi dikonfirmasi' },
                    ].map(({ n, text }) => (
                      <div key={n} className="flex gap-2.5 items-start">
                        <span className="w-4 h-4 rounded-full bg-amber-500/20 border border-amber-500/30 text-amber-400 text-[9px] font-black flex items-center justify-center shrink-0 mt-0.5">{n}</span>
                        <p className="text-[11px] text-outline/80 leading-relaxed">{text}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex gap-3">
                  <button onClick={() => setStep(1)}
                    className="h-11 px-4 rounded-xl border border-white/10 text-xs font-bold text-outline hover:bg-white/5 cursor-pointer transition-colors">
                    ← Kembali
                  </button>
                  <a href="https://trakteer.id/NuranantoScanlation" target="_blank" rel="noopener noreferrer"
                    className="flex-1 h-11 rounded-xl bg-gradient-to-r from-amber-400 to-amber-600 hover:from-amber-500 hover:to-amber-700 text-white font-black text-sm flex items-center justify-center gap-2 transition-all active:scale-[0.98] cursor-pointer">
                    <Coins className="w-4 h-4 fill-current" />
                    Buka Trakteer
                  </a>
                </div>
              </>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

// Unlock Chapter Confirmation Modal
export function UnlockModal({ isOpen, onClose, chapter, userCoins, onConfirm, onGoToStore }) {
  if (!isOpen || !chapter) return null;
  const cost = 5;
  const canUnlock = userCoins >= cost;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[400] flex items-center justify-center bg-black/75 backdrop-blur-md px-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0"
        />

        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          className="relative w-full max-w-sm bg-surface-container border border-white/10 rounded-xl shadow-2xl p-6 overflow-hidden z-10 flex flex-col items-center text-center animate-[slideUp_0.25s_ease-out]"
        >
          {/* Top golden glow */}
          <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-48 h-48 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />

          {/* Icon */}
          <div className="w-14 h-14 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mb-4 text-amber-400">
            <Coins className="w-7 h-7 fill-current text-amber-400" />
          </div>

          <h3 className="text-lg font-black text-on-surface">Buka Chapter Premium</h3>
          <p className="text-xs text-outline mt-1 mb-4">
            Membuka <span className="text-on-surface font-bold">{chapter.title}</span>
          </p>

          {/* Balance comparison */}
          <div className="w-full bg-surface-container-high border border-white/5 rounded-xl p-4 flex flex-col gap-2 mb-6">
            <div className="flex justify-between items-center text-xs">
              <span className="text-outline font-medium">Biaya Buka:</span>
              <span className="font-extrabold text-on-surface flex items-center gap-1">
                <Coins className="w-3.5 h-3.5 fill-current text-amber-500" />
                {cost} Koin
              </span>
            </div>
            <div className="flex justify-between items-center text-xs border-t border-white/5 pt-2">
              <span className="text-outline font-medium">Koin Anda:</span>
              <span className={`font-extrabold flex items-center gap-1 ${canUnlock ? 'text-amber-300' : 'text-red-400'}`}>
                <Coins className="w-3.5 h-3.5 fill-current text-amber-500" />
                {userCoins} Koin
              </span>
            </div>
          </div>

          {canUnlock ? (
            /* Confirm Action Buttons */
            <div className="flex w-full gap-3">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 h-11 rounded-lg border border-white/10 text-xs font-bold text-outline hover:bg-white/5 hover:text-on-surface transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={onConfirm}
                className="flex-1 h-11 rounded-lg bg-gradient-to-r from-amber-400 via-yellow-500 to-amber-600 hover:from-amber-500 hover:to-amber-700 text-white text-xs font-black transition-colors cursor-pointer shadow-lg hover:shadow-amber-500/20"
              >
                Buka Sekarang
              </button>
            </div>
          ) : (
            /* Insufficient Coins Warning Buttons */
            <div className="flex flex-col w-full gap-3">
              <div className="text-[10px] text-red-400 font-bold mb-1">
                ⚠️ Koin Anda tidak mencukupi untuk membuka chapter ini.
              </div>
              <button
                type="button"
                onClick={onGoToStore}
                className="w-full h-11 rounded-lg bg-gradient-to-r from-amber-400 via-yellow-500 to-amber-600 hover:from-amber-500 hover:to-amber-700 text-white text-xs font-black transition-colors cursor-pointer shadow-lg hover:shadow-amber-500/20"
              >
                Beli Koin Sekarang
              </button>
              <button
                type="button"
                onClick={onClose}
                className="w-full h-11 rounded-lg border border-white/10 text-xs font-bold text-outline hover:bg-white/5 hover:text-on-surface transition-colors cursor-pointer"
              >
                Batal
              </button>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

// ── Account Settings Modal — username + Trakteer email ───────
export function AccountSettingsModal({ isOpen, onClose, currentUser, nameChangedAt, onSave }) {
  const [username, setUsername] = useState(currentUser?.name || '');
  const [trakteerEmail, setTrakteerEmail] = useState(currentUser?.email || '');
  const [loading, setLoading] = useState(false);
  const [emailError, setEmailError] = useState('');

  // Hitung apakah username masih dalam cooldown 1 tahun
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
                : <p className="text-[10px] text-outline/60">Patokan pengiriman koin dari donasi Trakteer. Pastikan sama dengan email donasi kamu.</p>
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


// ── Locked Chapter Modal — unified for all access states ─────
export function LockedChapterModal({ isOpen, onClose, chapter, manga, isLoggedIn, userCoins, onConfirm, onLogin, onGoToStore }) {
  if (!isOpen || !chapter) return null;
  const cost = 5;
  const canUnlock = isLoggedIn && userCoins >= cost;

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
          className="relative w-full max-w-sm bg-surface-container border border-white/10 rounded-2xl shadow-2xl overflow-hidden z-10"
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
                <span className="font-label-sm text-xs sm:text-sm md:text-base font-black text-amber-400 uppercase tracking-wider">Chapter Terkunci</span>
              </div>
              <p className="font-body-md text-sm sm:text-base text-outline/70 font-semibold truncate">{manga?.title || ''}</p>
              <h3 className="font-headline-md text-base sm:text-lg md:text-xl font-black text-on-surface mt-0.5 line-clamp-2">{chapter.title}</h3>
            </div>
          </div>
          {chapter.unlockDate && (
            <div className="mx-5 mb-5 bg-surface-container-high/40 rounded-xl py-4 px-4 border border-white/5 flex flex-col items-center gap-3">
              <p className="font-label-sm text-xs sm:text-sm md:text-base text-outline/50 font-bold uppercase tracking-widest">Gratis untuk semua dalam</p>
              <CountdownBox unlockDate={chapter.unlockDate} />
            </div>
          )}
          <div className="px-5 pb-5 flex flex-col gap-2">
            {!isLoggedIn ? (
              <button onClick={onLogin}
                className="w-full h-12 sm:h-14 rounded-xl bg-gradient-to-r from-amber-400 to-amber-600 hover:from-amber-500 hover:to-amber-700 text-white font-black text-sm sm:text-base md:text-lg flex items-center justify-center gap-2 active:scale-[0.97] transition-all cursor-pointer shadow-lg shadow-amber-900/30">
                <Coins className="w-4 h-4 sm:w-5 sm:h-5 fill-current" />
                Login &amp; Beli dengan {cost} Koin
              </button>
            ) : canUnlock ? (
              <button onClick={onConfirm}
                className="w-full h-12 sm:h-14 rounded-xl bg-gradient-to-r from-amber-400 to-amber-600 hover:from-amber-500 hover:to-amber-700 text-white font-black text-sm sm:text-base md:text-lg flex items-center justify-center gap-2 active:scale-[0.97] transition-all cursor-pointer shadow-lg shadow-amber-900/30">
                <Coins className="w-4 h-4 sm:w-5 sm:h-5 fill-current" />
                Beli dengan {cost} Koin
              </button>
            ) : (
              <button onClick={onGoToStore}
                className="w-full h-12 sm:h-14 rounded-xl bg-gradient-to-r from-amber-400 to-amber-600 hover:from-amber-500 hover:to-amber-700 text-white font-black text-sm sm:text-base md:text-lg flex items-center justify-center gap-2 active:scale-[0.97] transition-all cursor-pointer shadow-lg shadow-amber-900/30">
                <Coins className="w-4 h-4 sm:w-5 sm:h-5 fill-current" />
                Koin tidak cukup — Isi Koin
              </button>
            )}
            <button onClick={onClose}
              className="w-full h-10 sm:h-12 rounded-xl border border-white/10 text-xs sm:text-sm md:text-base font-bold text-outline hover:text-on-surface hover:bg-white/5 transition-all cursor-pointer">
              Tunggu sampai gratis
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
