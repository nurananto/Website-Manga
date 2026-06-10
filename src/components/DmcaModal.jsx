import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

export default function DmcaModal({ onClose }) {
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[300] bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ y: 40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 40, opacity: 0 }}
          transition={{ type: 'spring', damping: 28, stiffness: 300 }}
          onClick={e => e.stopPropagation()}
          className="bg-surface-container border border-white/10 rounded-t-3xl sm:rounded-2xl w-full sm:max-w-xl max-h-[85vh] flex flex-col shadow-2xl"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-white/8 shrink-0">
            <div>
              <h2 className="font-headline-md text-base font-black text-on-surface">DMCA</h2>
              <p className="font-label-sm text-[10px] text-outline/50 mt-0.5">Copyright Infringement Policy</p>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center text-outline/60 hover:text-on-surface transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Content */}
          <div className="overflow-y-auto px-5 py-4 flex flex-col gap-5 hide-scrollbar">

            <Section title="1. Overview">
              <p>Nurananto Scanlation respects the intellectual property rights of others and expects its users to do the same. In accordance with the Digital Millennium Copyright Act (DMCA), we will respond to claims of copyright infringement that are reported to us.</p>
            </Section>

            <Section title="2. Filing a DMCA Notice">
              <p>If you believe that your copyrighted work has been copied in a way that constitutes copyright infringement and is accessible on this site, please notify us. For your complaint to be valid under the DMCA, you must provide the following information:</p>
              <ol>
                <li>An electronic or physical signature of a person authorized to act on behalf of the copyright owner</li>
                <li>Identification of the copyrighted work that you claim has been infringed</li>
                <li>Identification of the material that is claimed to be infringing and where it is located on the service</li>
                <li>Information reasonably sufficient to permit us to contact you, such as your address, telephone number, and email address</li>
                <li>A statement that you have a good faith belief that use of the material in the manner complained of is not authorized by the copyright owner, its agent, or law</li>
                <li>A statement, made under penalty of perjury, that the above information is accurate, and that you are the copyright owner or are authorized to act on behalf of the owner</li>
              </ol>
            </Section>

            <Section title="3. Counter-Notice">
              <p>If you believe that your content was removed or disabled by mistake or misidentification, you may file a counter-notification with us. The counter-notification must include:</p>
              <ol>
                <li>Your physical or electronic signature</li>
                <li>Identification of the material that has been removed or to which access has been disabled</li>
                <li>A statement under penalty of perjury that you have a good faith belief that the material was removed or disabled as a result of mistake or misidentification</li>
                <li>Your name, address, and telephone number</li>
              </ol>
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
      <div className="font-body-sm text-xs text-outline/80 leading-relaxed flex flex-col gap-1.5 [&_ul]:flex [&_ul]:flex-col [&_ul]:gap-1 [&_ul]:pl-3 [&_li]:relative [&_li]:before:content-['•'] [&_li]:before:absolute [&_li]:before:-left-3 [&_li]:before:text-primary/60 [&_ol]:flex [&_ol]:flex-col [&_ol]:gap-1 [&_ol]:pl-4 [&_ol_li]:list-decimal [&_ol_li]:before:content-none [&_strong]:text-on-surface/80 [&_strong]:font-bold">
        {children}
      </div>
    </div>
  );
}
