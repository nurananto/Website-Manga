import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

export default function TermsOfServiceModal({ onClose }) {
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
              <h2 className="font-headline-md text-base font-black text-on-surface">Terms of Service</h2>
              <p className="font-label-sm text-[10px] text-outline/50 mt-0.5">Last updated: January 2025</p>
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

            <Section title="1. Acceptance of Terms">
              <p>By accessing and using Nurananto Scanlation, you accept and agree to be bound by the terms and provisions of this agreement. If you do not agree to these terms, please do not use our services.</p>
            </Section>

            <Section title="2. Use of Service">
              <p>You agree to use our services only for lawful purposes and in accordance with these Terms. You agree not to:</p>
              <ul>
                <li>Use the service in any way that violates applicable laws or regulations</li>
                <li>Attempt to gain unauthorized access to any portion of the service</li>
                <li>Interfere with or disrupt the service or servers</li>
                <li>Distribute malware or other harmful code</li>
                <li>Scrape or copy content without permission</li>
                <li>Use bots, scripts, automation, coordinated accounts, or any deceptive method to interfere with, manipulate, or abuse the service or its features</li>
              </ul>
            </Section>

            <Section title="3. User Accounts">
              <p>When you create an account with us, you must provide accurate and complete information. You are responsible for safeguarding your account and for all activities that occur under your account.</p>
            </Section>

            <Section title="4. Content">
              <p>All content on Nurananto Scanlation, including manga, manhwa, and manhua, is provided for entertainment purposes. We do not claim ownership of the original works and respect the rights of content creators.</p>
            </Section>

            <Section title="5. Premium Services">
              <p>Some features may require coins or premium access. By purchasing, you agree to pay the applicable fees and abide by any additional terms specific to premium services.</p>
            </Section>

            <Section title="6. Termination">
              <p>We may terminate or suspend your account immediately, without prior notice or liability, for any reason, including without limitation if you breach these Terms.</p>
              <p>Where we reasonably determine that fraud, abuse, manipulation, or coordinated account activity occurred, we may remove related activity, revoke access or benefits, suspend or permanently ban related accounts, and deny refunds to the extent permitted by law.</p>
            </Section>

            <Section title="7. Limitation of Liability">
              <p>In no event shall Nurananto Scanlation be liable for any indirect, incidental, special, consequential or punitive damages arising out of your use of the service.</p>
            </Section>

            <Section title="8. Changes to Terms">
              <p>We reserve the right to modify or replace these Terms at any time. We will provide notice of any significant changes by posting the new Terms on this page.</p>
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
      <div className="font-body-sm text-xs text-outline/80 leading-relaxed flex flex-col gap-1.5 [&_ul]:flex [&_ul]:flex-col [&_ul]:gap-1 [&_ul]:pl-3 [&_li]:relative [&_li]:before:content-['•'] [&_li]:before:absolute [&_li]:before:-left-3 [&_li]:before:text-primary/60 [&_strong]:text-on-surface/80 [&_strong]:font-bold">
        {children}
      </div>
    </div>
  );
}
