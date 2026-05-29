import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Coins, Shield, Mail, Lock, CheckCircle2, AlertCircle, Clock } from 'lucide-react';

// Login Modal
export function AuthModal({ isOpen, onClose, onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Email dan password harus diisi.');
      return;
    }
    // Simulate successful login
    onLogin();
    onClose();
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
          className="relative w-full max-w-md bg-surface-container border border-white/10 rounded-xl shadow-2xl p-6 md:p-8 overflow-hidden z-10"
        >
          {/* Top light effect */}
          <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-72 h-72 bg-primary/10 rounded-full blur-3xl pointer-events-none" />

          {/* Header */}
          <div className="flex justify-between items-center border-b border-white/5 pb-4 mb-6">
            <div>
              <h3 className="text-xl font-black text-on-surface">Masuk Akun</h3>
              <p className="text-xs text-outline mt-1">Harap masuk untuk mengakses fitur premium</p>
            </div>
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-outline hover:text-on-surface transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="flex flex-col gap-4 relative">
             {error && (
              <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/25 p-3.5 rounded-xl text-xs font-bold text-red-400">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-black text-outline uppercase tracking-wider">Alamat Email</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-outline absolute left-4 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setError(''); }}
                  className="w-full bg-surface-container-high border border-white/5 rounded-xl py-3.5 pl-11 pr-4 text-sm text-on-surface placeholder:text-outline focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all font-medium"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-black text-outline uppercase tracking-wider">Kata Sandi</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-outline absolute left-4 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setError(''); }}
                  className="w-full bg-surface-container-high border border-white/5 rounded-xl py-3.5 pl-11 pr-4 text-sm text-on-surface placeholder:text-outline focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all font-medium"
                />
              </div>
            </div>

            {/* Remember Me & Forgot Password */}
            <div className="flex items-center justify-between text-xs mt-1">
              <label className="flex items-center gap-2 text-on-surface-variant cursor-pointer select-none">
                <input type="checkbox" className="rounded bg-surface-container-high border-white/5 text-primary focus:ring-0" />
                <span>Ingat saya</span>
              </label>
              <a href="#" onClick={(e) => e.preventDefault()} className="text-primary font-bold hover:underline">
                Lupa Password?
              </a>
            </div>

            {/* Login Button */}
            <button
              type="submit"
              className="w-full h-12 rounded-xl bg-gradient-to-r from-sky-400 to-indigo-600 hover:from-sky-500 hover:to-indigo-700 text-white text-sm font-black transition-all cursor-pointer shadow-lg hover:shadow-indigo-500/25 mt-4 active:scale-98"
            >
              Masuk Sekarang
            </button>

            {/* Social Login Divider */}
            <div className="flex items-center gap-3 my-2">
              <div className="h-px bg-white/5 flex-1" />
              <span className="text-[10px] font-black text-outline uppercase tracking-wider">Atau Masuk Dengan</span>
              <div className="h-px bg-white/5 flex-1" />
            </div>

            {/* Social Logins */}
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => { onLogin(); onClose(); }}
                className="h-11 rounded-lg bg-surface-container-high border border-white/5 hover:bg-white/5 flex items-center justify-center gap-2 text-xs font-bold text-on-surface cursor-pointer active:scale-95 transition-all"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                  <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                </svg>
                <span>Google</span>
              </button>
              <button
                type="button"
                onClick={() => { onLogin(); onClose(); }}
                className="h-11 rounded-lg bg-surface-container-high border border-white/5 hover:bg-white/5 flex items-center justify-center gap-2 text-xs font-bold text-on-surface cursor-pointer active:scale-95 transition-all"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path fill="currentColor" d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 4.17c.66-.81 1.11-1.93.99-3.06-1 .04-2.22.67-2.94 1.5-.63.73-1.18 1.87-1.03 2.98 1.12.09 2.27-.56 2.98-1.42z" />
                </svg>
                <span>Apple</span>
              </button>
            </div>
          </form>
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
