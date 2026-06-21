import { useEffect, useRef } from 'react';
import { trackLocalPrefsCleared } from '../../lib/analytics';
import { clearAllLocalPrefs } from '../../lib/homePreferences';
import YourAreaForm from './YourAreaForm';
import SubscribedTicketsForm from './SubscribedTicketsForm';

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2.5">
      {children}
    </p>
  );
}

interface ProfilePanelProps {
  open: boolean;
  onClose: () => void;
}

/** Device-local profile: address, ward, and saved searches — not a user account. */
export default function ProfilePanel({ open, onClose }: ProfilePanelProps) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  const handleClearLocalPrefs = () => {
    clearAllLocalPrefs();
    trackLocalPrefsCleared();
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 sm:p-8"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="bg-surface rounded-xl shadow-xl max-w-lg w-full flex flex-col max-h-[calc(100vh-2rem)] sm:max-h-[calc(100vh-4rem)]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="profile-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 pt-5 pb-4 shrink-0 border-b border-gray-100">
          <div>
            <h2 id="profile-title" className="text-base font-semibold text-gray-900 tracking-tight mb-0">
              Profile
            </h2>
            <p className="text-xs text-gray-400 mt-0.5 mb-0">
              Saved on this device — not an account.
            </p>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors text-lg leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="overflow-y-auto scrollbar-thin px-6 py-5 space-y-6 text-sm text-gray-600 leading-relaxed">
          <section>
            <SectionLabel>Your area</SectionLabel>
            <YourAreaForm />
          </section>

          <hr className="border-gray-100" />

          <section>
            <SectionLabel>Saved searches</SectionLabel>
            <p className="text-xs text-gray-400 mb-3">
              Star a lookup on Estimate, or add a ticket below. Drag to reorder.
            </p>
            <SubscribedTicketsForm />
          </section>
        </div>

        <div className="px-6 py-4 shrink-0 border-t border-gray-100">
          <button
            type="button"
            onClick={handleClearLocalPrefs}
            className="text-caption text-text-muted hover:text-gray-900 transition-colors"
          >
            Clear profile data
          </button>
        </div>
      </div>
    </div>
  );
}
