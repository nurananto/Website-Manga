import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';

export default function DisclaimerModal({ onClose }) {
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[300] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ y: 32, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 32, opacity: 0 }}
          transition={{ type: 'spring', damping: 28, stiffness: 300 }}
          onClick={(event) => event.stopPropagation()}
          className="w-full max-w-lg rounded-2xl border border-white/10 bg-surface-container shadow-2xl"
        >
          <div className="flex items-center justify-between border-b border-white/8 px-5 pb-4 pt-5">
            <div>
              <h2 className="font-headline-md text-base font-black text-on-surface">Disclaimer</h2>
              <p className="mt-0.5 font-label-sm text-[10px] text-outline/50">Fan Translation Unofficial</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Tutup disclaimer"
              className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-xl bg-white/5 text-outline/60 transition-colors hover:bg-white/10 hover:text-on-surface"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex flex-col gap-3 px-5 py-5 font-body-sm text-xs leading-relaxed text-outline/80">
            <p>
              Nurananto Scanlation adalah situs fan terjemahan <em>unofficial</em> yang dibuat semata-mata karena kecintaan terhadap manga.
            </p>
            <p>
              Seluruh karya yang ditampilkan merupakan milik penerbit, pengarang, dan pemegang hak cipta masing-masing.
            </p>
            <p>
              Jika versi resmi dalam bahasa Indonesia sudah tersedia, kami sangat mendukung pembaca untuk membeli dan mendukung karya aslinya.
            </p>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
