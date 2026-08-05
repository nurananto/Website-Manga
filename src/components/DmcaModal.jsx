import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { useRef } from 'react';
import { useDialogFocus } from '../lib/useDialogFocus';

export default function DmcaModal({ onClose }) {
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
          aria-labelledby="dmca-title"
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
              <h2 id="dmca-title" className="font-headline-md text-base font-black text-on-surface">Kebijakan DMCA</h2>
              <p className="font-label-sm text-[10px] text-on-surface-variant mt-0.5">Perlindungan Hak Cipta</p>
            </div>
            <button
              type="button"
              aria-label="Tutup kebijakan DMCA"
              onClick={onClose}
              className="w-8 h-8 rounded-xl bg-surface-container-high hover:bg-surface-container-highest flex items-center justify-center text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="overflow-y-auto px-5 py-4 flex flex-col gap-5 hide-scrollbar">

            <Section title="1. Ikhtisar">
              <p>Nurananto Scanlation menghormati hak kekayaan intelektual pihak lain dan mengharapkan penggunanya untuk melakukan hal yang sama. Sesuai dengan Digital Millennium Copyright Act (DMCA), kami akan merespons klaim pelanggaran hak cipta yang dilaporkan kepada kami.</p>
              <p>Nurananto Scanlation adalah situs fan terjemahan tidak resmi yang dibuat atas dasar kecintaan terhadap manga. Jika kamu adalah pemilik hak cipta dan merasa kontenmu ditampilkan di sini tanpa izin, silakan hubungi kami dan kami akan segera menindaklanjutinya.</p>
            </Section>

            <Section title="2. Cara Mengajukan Pemberitahuan DMCA">
              <p>Jika kamu yakin bahwa karya berhak ciptamu telah disalin sehingga melanggar hak cipta dan dapat diakses di situs ini, harap beri tahu kami. Agar pengaduanmu sah berdasarkan DMCA, kamu harus menyertakan informasi berikut:</p>
              <ol>
                <li>Tanda tangan elektronik atau fisik dari orang yang berwenang atas nama pemilik hak cipta</li>
                <li>Identifikasi karya berhak cipta yang kamu klaim telah dilanggar</li>
                <li>Identifikasi materi yang diduga melanggar beserta lokasinya di layanan kami</li>
                <li>Informasi yang cukup untuk menghubungimu, seperti alamat, nomor telepon, dan alamat email</li>
                <li>Pernyataan bahwa kamu memiliki keyakinan itikad baik bahwa penggunaan materi tersebut tidak diizinkan oleh pemilik hak cipta, agennya, atau hukum</li>
                <li>Pernyataan di bawah sumpah bahwa informasi di atas akurat, dan bahwa kamu adalah pemilik hak cipta atau berwenang untuk bertindak atas nama pemilik</li>
              </ol>
            </Section>

            <Section title="3. Pemberitahuan Balik">
              <p>Jika kamu yakin kontenmu dihapus atau dinonaktifkan karena kesalahan atau salah identifikasi, kamu dapat mengajukan pemberitahuan balik kepada kami. Pemberitahuan balik harus menyertakan:</p>
              <ol>
                <li>Tanda tangan fisik atau elektronikmu</li>
                <li>Identifikasi materi yang telah dihapus atau aksesnya dinonaktifkan</li>
                <li>Pernyataan di bawah sumpah bahwa kamu memiliki keyakinan itikad baik bahwa materi dihapus atau dinonaktifkan akibat kesalahan atau salah identifikasi</li>
                <li>Nama, alamat, dan nomor teleponmu</li>
              </ol>
            </Section>

            <Section title="4. Kebijakan Pelanggar Berulang">
              <p>Sesuai dengan DMCA dan hukum yang berlaku, kami menerapkan kebijakan untuk menghentikan akun pengguna yang terbukti berulang kali melanggar hak cipta, dalam keadaan yang kami anggap tepat dan atas kebijakan kami sendiri.</p>
            </Section>

            <Section title="5. Informasi Kontak">
              <p>Kirimkan semua pemberitahuan DMCA dan pemberitahuan balik kepada:</p>
              <div className="mt-1 p-3 rounded-xl bg-surface-container-high border border-outline-variant/40 flex flex-col gap-0.5">
                <strong>DMCA Agent</strong>
                <span>Nurananto Scanlation</span>
                <span>Email: <a href="mailto:admin@nuranantoscans.my.id" className="text-primary hover:underline">admin@nuranantoscans.my.id</a></span>
              </div>
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
      <div className="font-body-sm text-xs text-on-surface-variant leading-relaxed flex flex-col gap-1.5 [&_ul]:flex [&_ul]:flex-col [&_ul]:gap-1 [&_ul]:pl-3 [&_li]:relative [&_li]:before:content-['•'] [&_li]:before:absolute [&_li]:before:-left-3 [&_li]:before:text-primary/60 [&_ol]:flex [&_ol]:flex-col [&_ol]:gap-1 [&_ol]:pl-4 [&_ol_li]:list-decimal [&_ol_li]:before:content-none [&_strong]:text-on-surface/80 [&_strong]:font-bold">
        {children}
      </div>
    </div>
  );
}
