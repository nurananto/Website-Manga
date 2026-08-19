import { X } from 'lucide-react';
import { useRef } from 'react';
import { useDialogFocus } from '../lib/useDialogFocus';

// framer-motion dicopot — lihat catatan di DmcaModal.jsx.
export default function PrivacyPolicyModal({ onClose }) {
  const dialogRef = useRef(null);
  useDialogFocus(dialogRef, onClose);
  return (
    <div
      className="fixed inset-0 z-[300] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-[fadeIn_0.2s_ease-out]"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="privacy-title"
        tabIndex={-1}
        onClick={e => e.stopPropagation()}
        className="bg-surface-container border-2 border-outline-variant rounded-2xl w-full max-w-xl max-h-[85vh] flex flex-col shadow-2xl animate-[slideUpFade_0.3s_cubic-bezier(0.22,1,0.36,1)]"
      >
          <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-outline-variant/50 shrink-0">
            <div>
              <h2 id="privacy-title" className="font-headline-md text-base font-black text-on-surface">Kebijakan Privasi</h2>
              <p className="font-label-sm text-[10px] text-on-surface-variant mt-0.5">Terakhir diperbarui: 10 Juni 2025</p>
            </div>
            <button
              type="button"
              aria-label="Tutup kebijakan privasi"
              onClick={onClose}
              className="w-8 h-8 rounded-xl bg-surface-container-high hover:bg-surface-container-highest flex items-center justify-center text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="overflow-y-auto px-5 py-4 flex flex-col gap-5 hide-scrollbar">

            <Section title="1. Informasi yang Kami Kumpulkan">
              <p>Kami mengumpulkan informasi yang kamu berikan secara langsung, seperti saat membuat akun atau menghubungi kami untuk mendapatkan bantuan.</p>
              <ul>
                <li><strong>Informasi Akun</strong> — email, nama pengguna, dan password yang dienkripsi dengan aman (kami tidak pernah menyimpan atau memiliki akses ke password aslimu)</li>
                <li><strong>Data Penggunaan</strong> — riwayat baca dan preferensi membaca</li>
                <li><strong>Informasi Perangkat</strong> — jenis browser dan data perangkat</li>
                <li><strong>Data Jaringan</strong> — alamat IP dan lokasi</li>
              </ul>
            </Section>

            <Section title="2. Cara Kami Menggunakan Informasi">
              <p>Kami menggunakan informasi yang dikumpulkan untuk:</p>
              <ul>
                <li>Menyediakan, memelihara, dan meningkatkan layanan kami</li>
                <li>Mempersonalisasi pengalaman membacamu</li>
                <li>Mengirim pembaruan dan notifikasi</li>
                <li>Melindungi dari penipuan dan penyalahgunaan</li>
              </ul>
            </Section>

            <Section title="3. Berbagi Informasi">
              <p>Kami tidak menjual, memperdagangkan, atau mengalihkan informasi pribadimu kepada pihak ketiga tanpa persetujuanmu, kecuali sebagaimana dijelaskan dalam kebijakan ini atau diwajibkan oleh hukum.</p>
            </Section>

            <Section title="4. Cookie dan Pelacakan">
              <p>Kami menggunakan cookie dan teknologi pelacakan serupa untuk melacak aktivitas di situs web kami dan menyimpan informasi tertentu. Kamu dapat mengatur browser untuk menolak semua cookie atau memberikan notifikasi saat cookie dikirim.</p>
            </Section>

            <Section title="5. Keamanan Data">
              <p>Kami menerapkan langkah-langkah keamanan yang sesuai untuk melindungi informasi pribadimu. Namun, tidak ada metode transmisi melalui Internet atau penyimpanan elektronik yang 100% aman.</p>
            </Section>

            <Section title="6. Hak Kamu">
              <p>Kamu berhak untuk mengakses, memperbarui, atau menghapus informasi pribadimu. Hal ini dapat dilakukan melalui pengaturan akun atau dengan menghubungi kami secara langsung.</p>
            </Section>

            <div className="pb-2" />
          </div>
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div className="flex flex-col gap-2">
      <h3 className="font-label-sm text-xs font-black text-primary uppercase tracking-wider">{title}</h3>
      <div className="font-body-sm text-xs text-on-surface-variant leading-relaxed flex flex-col gap-1.5 [&_ul]:flex [&_ul]:flex-col [&_ul]:gap-1 [&_ul]:pl-3 [&_li]:relative [&_li]:before:content-['•'] [&_li]:before:absolute [&_li]:before:-left-3 [&_li]:before:text-primary/80 [&_strong]:text-on-surface/80 [&_strong]:font-bold">
        {children}
      </div>
    </div>
  );
}
