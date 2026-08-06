import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { useRef } from 'react';
import { useDialogFocus } from '../lib/useDialogFocus';

export default function TermsOfServiceModal({ onClose }) {
  const dialogRef = useRef(null);
  useDialogFocus(dialogRef, onClose);
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[300] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="terms-title"
          tabIndex={-1}
          initial={{ y: 40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 40, opacity: 0 }}
          transition={{ type: 'spring', damping: 28, stiffness: 300 }}
          onClick={e => e.stopPropagation()}
          className="bg-surface-container border-2 border-outline-variant rounded-2xl w-full max-w-xl max-h-[85vh] flex flex-col shadow-2xl"
        >
          <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-outline-variant/50 shrink-0">
            <div>
              <h2 id="terms-title" className="font-headline-md text-base font-black text-on-surface">Syarat dan Ketentuan</h2>
              <p className="font-label-sm text-[10px] text-on-surface-variant mt-0.5">Terakhir diperbarui: 10 Juni 2025</p>
            </div>
            <button
              type="button"
              aria-label="Tutup syarat dan ketentuan"
              onClick={onClose}
              className="w-8 h-8 rounded-xl bg-surface-container-high hover:bg-surface-container-highest flex items-center justify-center text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="overflow-y-auto px-5 py-4 flex flex-col gap-5 hide-scrollbar">

            <Section title="1. Penerimaan Syarat">
              <p>Dengan mengakses dan menggunakan Nurananto Scanlation, kamu menyetujui dan terikat oleh syarat serta ketentuan yang tercantum dalam perjanjian ini. Jika kamu tidak menyetujui syarat-syarat ini, harap tidak menggunakan layanan kami.</p>
            </Section>

            <Section title="2. Penggunaan Layanan">
              <p>Kamu setuju untuk menggunakan layanan kami hanya untuk tujuan yang sah dan sesuai dengan Syarat ini. Kamu setuju untuk tidak:</p>
              <ul>
                <li>Menggunakan layanan dengan cara yang melanggar hukum atau peraturan yang berlaku</li>
                <li>Mencoba mendapatkan akses tidak sah ke bagian mana pun dari layanan</li>
                <li>Mengganggu atau merusak layanan atau server</li>
                <li>Mendistribusikan malware atau kode berbahaya lainnya</li>
                <li>Mengambil atau menyalin konten tanpa izin</li>
                <li>Menggunakan bot, skrip, otomatisasi, akun terkoordinasi, atau metode curang apa pun untuk mengganggu, memanipulasi, atau menyalahgunakan layanan</li>
              </ul>
            </Section>

            <Section title="3. Akun Pengguna">
              <p>Saat membuat akun, kamu harus memberikan informasi yang akurat dan lengkap. Kamu bertanggung jawab atas keamanan akun dan seluruh aktivitas yang terjadi di bawah akunmu.</p>
            </Section>

            <Section title="4. Konten">
              <p>Seluruh konten di Nurananto Scanlation, termasuk manga, manhwa, dan manhua, disediakan untuk tujuan hiburan semata. Kami tidak mengklaim kepemilikan atas karya asli dan menghormati hak para pencipta konten.</p>
            </Section>

            <Section title="5. Koin dan Akses Premium">
              <p>Beberapa fitur memerlukan koin atau akses premium. Dengan melakukan pembelian, kamu menyetujui biaya yang berlaku dan tunduk pada syarat tambahan yang berkaitan dengan fitur premium.</p>
            </Section>

            <Section title="6. Penghentian Akun">
              <p>Kami dapat menghentikan atau menangguhkan akunmu secara langsung, tanpa pemberitahuan atau kewajiban sebelumnya, karena alasan apa pun, termasuk jika kamu melanggar Syarat ini.</p>
              <p>Jika kami secara wajar menetapkan terjadinya penipuan, penyalahgunaan, manipulasi, atau aktivitas akun terkoordinasi, kami dapat menghapus aktivitas terkait, mencabut akses atau manfaat, menangguhkan atau memblokir akun secara permanen, dan menolak pengembalian dana sesuai hukum yang berlaku.</p>
            </Section>

            <Section title="7. Batasan Tanggung Jawab">
              <p>Dalam keadaan apa pun, Nurananto Scanlation tidak bertanggung jawab atas kerugian tidak langsung, insidental, khusus, konsekuensial, atau punitif yang timbul dari penggunaan layanan kami.</p>
            </Section>

            <Section title="8. Perubahan Syarat">
              <p>Kami berhak untuk mengubah atau mengganti Syarat ini kapan saja. Kami akan memberikan pemberitahuan atas perubahan signifikan dengan memposting Syarat baru di halaman ini.</p>
            </Section>

            <div className="pb-2" />
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
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
