import { X } from 'lucide-react';
import { useRef } from 'react';
import { useDialogFocus } from '../lib/useDialogFocus';

// framer-motion dicopot — lihat catatan di DmcaModal.jsx.
export default function DisclaimerModal({ onClose }) {
  const dialogRef = useRef(null);
  useDialogFocus(dialogRef, onClose);
  return (
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="disclaimer-title"
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
        className="w-full max-w-lg rounded-2xl border-2 border-outline-variant bg-surface-container shadow-2xl animate-[slideUpFade_0.3s_cubic-bezier(0.22,1,0.36,1)]"
      >
          <div className="flex items-center justify-between border-b border-outline-variant/50 px-5 pb-4 pt-5">
            <div>
              <h2 id="disclaimer-title" className="font-headline-md text-base font-black text-on-surface">Disclaimer</h2>
              <p className="mt-0.5 font-label-sm text-[10px] text-on-surface-variant">Fan Translation Unofficial</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Tutup disclaimer"
              className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-xl bg-surface-container-high text-on-surface-variant transition-colors hover:bg-surface-container-highest hover:text-on-surface"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex flex-col gap-3 px-5 py-5 font-body-sm text-xs leading-relaxed text-on-surface-variant">
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
      </div>
    </div>
  );
}
