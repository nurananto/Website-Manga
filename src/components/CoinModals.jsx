import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Coins, Shield, Mail, CheckCircle2, AlertCircle, Clock, Send } from 'lucide-react';
import { supabase } from '../lib/supabase';

// ── Auth Modal — Magic Link + Google + Discord ────────────────
export function AuthModal({ isOpen, onClose }) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const handleMagicLink = async (e) => {
    e.preventDefault();
    if (!email) { setError('Masukkan alamat email.'); return; }
    setLoading(true); setError('');
    const { error: err } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin },
    });
    setLoading(false);
    if (err) setError(err.message);
    else setSent(true);
  };

  const handleOAuth = async (provider) => {
    setError('');
    const { error: err } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: window.location.origin },
    });
    if (err) setError(err.message);
  };

  const handleClose = () => { setSent(false); setEmail(''); setError(''); onClose(); };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md px-4">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={handleClose} className="absolute inset-0" />

        <motion.div initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          className="relative w-full max-w-sm bg-surface-container border border-white/10 rounded-2xl shadow-2xl p-6 overflow-hidden z-10"
        >
          <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-72 h-72 bg-primary/10 rounded-full blur-3xl pointer-events-none" />

          {/* Header */}
          <div className="flex justify-between items-start mb-6">
            <div>
              <h3 className="text-lg font-black text-on-surface">Masuk Akun</h3>
              <p className="text-xs text-outline mt-0.5">Akses bookmark, koin, dan fitur lainnya</p>
            </div>
            <button onClick={handleClose}
              className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-outline cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          </div>

          {sent ? (
            /* Magic link sent state */
            <div className="flex flex-col items-center gap-4 py-4 text-center">
              <div className="w-14 h-14 rounded-full bg-emerald-500/10 flex items-center justify-center">
                <Send className="w-7 h-7 text-emerald-400" />
              </div>
              <div>
                <p className="font-bold text-on-surface">Cek email kamu!</p>
                <p className="text-xs text-outline mt-1">Link masuk sudah dikirim ke <span className="text-primary font-bold">{email}</span>.<br/>Klik link tersebut untuk masuk.</p>
              </div>
              <button onClick={handleClose}
                className="w-full h-10 rounded-xl bg-white/5 border border-white/10 text-xs font-bold text-outline hover:text-on-surface transition-colors cursor-pointer">
                Tutup
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {error && (
                <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/25 p-3 rounded-xl text-xs font-bold text-red-400">
                  <AlertCircle className="w-4 h-4 shrink-0" /><span>{error}</span>
                </div>
              )}

              {/* Magic Link */}
              <form onSubmit={handleMagicLink} className="flex flex-col gap-3">
                <div className="relative">
                  <Mail className="w-4 h-4 text-outline absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input type="email" placeholder="Masukkan email kamu"
                    value={email} onChange={e => { setEmail(e.target.value); setError(''); }}
                    className="w-full bg-surface-container-high border border-white/5 rounded-xl py-3 pl-10 pr-4 text-sm text-on-surface placeholder:text-outline focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                  />
                </div>
                <button type="submit" disabled={loading}
                  className="w-full h-11 rounded-xl bg-gradient-to-r from-sky-400 to-indigo-600 hover:from-sky-500 hover:to-indigo-700 text-white text-sm font-black transition-all cursor-pointer disabled:opacity-50 active:scale-[0.98]">
                  {loading ? 'Mengirim...' : 'Kirim Magic Link'}
                </button>
              </form>

              <div className="flex items-center gap-3">
                <div className="h-px bg-white/8 flex-1" />
                <span className="text-[10px] font-bold text-outline uppercase tracking-wider">atau</span>
                <div className="h-px bg-white/8 flex-1" />
              </div>

              {/* OAuth buttons */}
              <div className="flex flex-col gap-2">
                <button onClick={() => handleOAuth('google')}
                  className="w-full h-11 rounded-xl bg-surface-container-high border border-white/8 hover:bg-white/5 hover:border-white/15 flex items-center justify-center gap-3 text-sm font-bold text-on-surface cursor-pointer active:scale-[0.98] transition-all">
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                  </svg>
                  Masuk dengan Google
                </button>

                <button onClick={() => handleOAuth('discord')}
                  className="w-full h-11 rounded-xl bg-[#5865F2]/10 border border-[#5865F2]/30 hover:bg-[#5865F2]/20 flex items-center justify-center gap-3 text-sm font-bold text-on-surface cursor-pointer active:scale-[0.98] transition-all">
                  <svg className="w-4 h-4 text-[#5865F2]" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057c.002.022.015.04.032.05a19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/>
                  </svg>
                  Masuk dengan Discord
                </button>
              </div>

              <p className="text-center text-[10px] text-outline/60 mt-1">
                Dengan masuk, kamu menyetujui syarat & ketentuan layanan kami.
              </p>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

// ── Trakteer Email Modal — muncul pertama kali login ──────────
export function TrakteerEmailModal({ isOpen, onClose, onSave }) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async (e) => {
    e.preventDefault();
    if (!email) { setError('Masukkan email Trakteer kamu.'); return; }
    setLoading(true);
    await onSave(email);
    setLoading(false);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/75 backdrop-blur-md px-4">
        <motion.div initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          className="relative w-full max-w-sm bg-surface-container border border-white/10 rounded-2xl shadow-2xl p-6 z-10"
        >
          <div className="flex flex-col gap-5">
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mx-auto mb-3">
                <Coins className="w-6 h-6 text-amber-400" />
              </div>
              <h3 className="text-base font-black text-on-surface">Hubungkan Trakteer</h3>
              <p className="text-xs text-outline mt-1.5 leading-relaxed">
                Masukkan email yang kamu gunakan di Trakteer agar donasi kamu otomatis dikonversi menjadi koin.
              </p>
            </div>

            {error && (
              <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/25 p-3 rounded-xl text-xs font-bold text-red-400">
                <AlertCircle className="w-4 h-4 shrink-0" /><span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSave} className="flex flex-col gap-3">
              <div className="relative">
                <Mail className="w-4 h-4 text-outline absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input type="email" placeholder="email@trakteer.id"
                  value={email} onChange={e => { setEmail(e.target.value); setError(''); }}
                  className="w-full bg-surface-container-high border border-white/5 rounded-xl py-3 pl-10 pr-4 text-sm text-on-surface placeholder:text-outline focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20 transition-all"
                />
              </div>

              <button type="submit" disabled={loading}
                className="w-full h-11 rounded-xl bg-gradient-to-r from-amber-400 to-amber-600 hover:from-amber-500 hover:to-amber-700 text-white font-black text-sm transition-all cursor-pointer disabled:opacity-50 active:scale-[0.98]">
                {loading ? 'Menyimpan...' : 'Simpan Email Trakteer'}
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
export function CoinPurchaseModal({ isOpen, onClose, userCoins, onPurchase }) {
  const [successPackage, setSuccessPackage] = useState(null);

  const packages = [
    { id: 'pack-starter', title: 'Paket Pemula', coins: 25, bonus: 0, price: 'Rp 5.000', tagline: 'Harga Terbaik' },
    { id: 'pack-standard', title: 'Paket Standar', coins: 60, bonus: 5, price: 'Rp 10.000', tagline: 'Paling Populer', isPopular: true },
    { id: 'pack-premium', title: 'Paket Premium', coins: 150, bonus: 20, price: 'Rp 20.000', tagline: 'Koin Melimpah' },
    { id: 'pack-sultan', title: 'Paket Sultan', coins: 400, bonus: 60, price: 'Rp 50.000', tagline: 'Paling Hemat' }
  ];

  const handleBuy = (pkg) => {
    const totalAdded = pkg.coins + pkg.bonus;
    onPurchase(totalAdded);
    setSuccessPackage(pkg);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md px-4">
        {/* Backdrop overlay */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0"
        />

        {/* Modal Container */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          className="relative w-full max-w-lg bg-surface-container border border-white/10 rounded-2xl shadow-2xl p-6 md:p-8 overflow-hidden z-10"
        >
          {/* Top golden light effect */}
          <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-80 h-80 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute right-6 top-6 w-9 h-9 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-outline hover:text-on-surface transition-colors cursor-pointer z-20"
          >
            <X className="w-5 h-5" />
          </button>

          {successPackage ? (
            /* Purchase Success Screen */
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center justify-center text-center py-10"
            >
              <div className="w-20 h-20 rounded-full bg-amber-500/10 flex items-center justify-center border-2 border-amber-500 shadow-[0_0_20px_rgba(245,158,11,0.3)] mb-6 animate-[pulse_2s_infinite]">
                <CheckCircle2 className="w-10 h-10 text-amber-400" />
              </div>
              <h3 className="text-2xl font-black text-on-surface">Top Up Berhasil!</h3>
              <p className="text-sm text-outline mt-2 max-w-sm">
                Selamat! Anda berhasil membeli <span className="text-amber-400 font-bold">+{successPackage.coins + successPackage.bonus} koin</span> menggunakan {successPackage.title}.
              </p>

              {/* Current balance display */}
              <div className="mt-6 bg-surface-container-high border border-white/5 px-6 py-3 rounded-xl flex items-center gap-3">
                <Coins className="w-5 h-5 text-amber-400 fill-current animate-bounce" />
                <span className="text-xs font-black text-outline uppercase tracking-wider">Koin Sekarang:</span>
                <span className="text-lg font-black text-amber-300">{userCoins}</span>
              </div>

              <button
                onClick={() => { setSuccessPackage(null); onClose(); }}
                className="mt-8 px-8 py-3 bg-gradient-to-r from-amber-400 via-yellow-500 to-amber-600 hover:from-amber-500 hover:to-amber-700 text-white text-xs font-black rounded-lg shadow-lg hover:shadow-amber-500/25 transition-all cursor-pointer"
              >
                Selesai
              </button>
            </motion.div>
          ) : (
            /* Main Coin Store Screen */
            <>
              {/* Header */}
              <div className="border-b border-white/5 pb-4 mb-6">
                <h3 className="text-2xl font-black text-on-surface flex items-center gap-2">
                  <Coins className="w-7 h-7 text-amber-400 fill-current" />
                  MangaFlow Coin Store
                </h3>
                <p className="text-xs text-outline mt-1">Gunakan koin untuk membuka chapter terbaru lebih cepat!</p>
              </div>

              {/* Balance Card */}
              <div className="bg-gradient-to-r from-amber-500/10 to-yellow-600/10 border border-amber-500/20 rounded-xl p-4 flex items-center justify-between mb-6 shadow-inner">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-amber-400/20 flex items-center justify-center">
                    <Coins className="w-5 h-5 text-amber-400 fill-current" />
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-outline uppercase tracking-wider">Koin Anda Saat Ini</p>
                    <p className="text-xl font-black text-amber-300">{userCoins}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1 text-[11px] font-bold text-amber-400/80 bg-amber-400/10 px-3 py-1 rounded-full border border-amber-400/10">
                  <Shield className="w-3.5 h-3.5" />
                  <span>Aman & Terpercaya</span>
                </div>
              </div>

              {/* Package Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {packages.map((pkg) => (
                  <div
                    key={pkg.id}
                    onClick={() => handleBuy(pkg)}
                    className={`relative p-5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between group active:scale-98 ${
                      pkg.isPopular
                        ? 'bg-gradient-to-b from-amber-500/25 to-surface-container-high border-amber-500 shadow-[0_4px_20px_rgba(245,158,11,0.15)]'
                        : 'bg-surface-container-high border-white/5 hover:border-amber-500/30'
                    }`}
                  >
                    {pkg.tagline && (
                      <span className={`absolute top-3 right-4 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                        pkg.isPopular ? 'bg-amber-400 text-surface font-black' : 'bg-white/5 text-outline'
                      }`}>
                        {pkg.tagline}
                      </span>
                    )}

                    <div>
                      <p className="text-xs font-black text-outline uppercase tracking-wider group-hover:text-amber-400 transition-colors">
                        {pkg.title}
                      </p>
                      <div className="flex items-baseline gap-1.5 mt-2">
                        <span className="text-2xl font-black text-on-surface">{pkg.coins}</span>
                        <span className="text-xs text-outline font-bold">Koin</span>
                        {pkg.bonus > 0 && (
                          <span className="text-xs font-black text-amber-400 ml-1">
                            +{pkg.bonus} Bonus
                          </span>
                        )}
                      </div>
                    </div>

                    <button
                      className={`w-full h-10 rounded-lg mt-4 text-xs font-black flex items-center justify-center transition-all cursor-pointer ${
                        pkg.isPopular
                          ? 'bg-amber-500 hover:bg-amber-600 text-white shadow-md'
                          : 'bg-white/5 hover:bg-amber-500/10 text-on-surface group-hover:bg-amber-500/10 border border-white/5 group-hover:border-amber-500/20'
                      }`}
                    >
                      Beli • {pkg.price}
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}
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
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md px-4">
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
