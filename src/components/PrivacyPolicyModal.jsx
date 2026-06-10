import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

export default function PrivacyPolicyModal({ onClose }) {
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
              <h2 className="font-headline-md text-base font-black text-on-surface">Privacy Policy</h2>
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

            <Section title="1. Information We Collect">
              <p>We collect information you provide directly to us, such as when you create an account or contact us for support.</p>
              <ul>
                <li><strong>Account Information</strong> — email, username, and a securely hashed password (we never store or have access to your actual password)</li>
                <li><strong>Usage Data</strong> — reading history and preferences</li>
                <li><strong>Device Information</strong> — browser type and device data</li>
                <li><strong>Network Data</strong> — IP address and location</li>
              </ul>
            </Section>

            <Section title="2. How We Use Your Information">
              <p>We use the information we collect to:</p>
              <ul>
                <li>Provide, maintain, and improve our services</li>
                <li>Personalize your reading experience</li>
                <li>Send you updates and notifications</li>
                <li>Protect against fraud and abuse</li>
              </ul>
            </Section>

            <Section title="3. Information Sharing">
              <p>We do not sell, trade, or otherwise transfer your personal information to third parties without your consent, except as described in this policy or as required by law.</p>
            </Section>

            <Section title="4. Cookies and Tracking">
              <p>We use cookies and similar tracking technologies to track activity on our website and hold certain information. You can instruct your browser to refuse all cookies or to indicate when a cookie is being sent.</p>
            </Section>

            <Section title="5. Data Security">
              <p>We implement appropriate security measures to protect your personal information. However, no method of transmission over the Internet or electronic storage is 100% secure.</p>
            </Section>

            <Section title="6. Your Rights">
              <p>You have the right to access, update, or delete your personal information. You can do this through your account settings or by contacting us directly.</p>
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
