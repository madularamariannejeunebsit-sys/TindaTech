import React, { useEffect } from 'react';
import { X } from 'lucide-react';

interface ModalSheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidthClass?: string;
}

export function ModalSheet({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  maxWidthClass = 'sm:max-w-lg',
}: ModalSheetProps) {
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-sheet-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={`w-full ${maxWidthClass} bg-white rounded-t-3xl sm:rounded-2xl shadow-xl border border-[#E6E4DF] max-h-[90vh] flex flex-col overflow-hidden`}
      >
        {/* Mobile grab handle */}
        <div className="sm:hidden pt-3 pb-1 flex justify-center shrink-0">
          <div className="w-10 h-1.5 rounded-full bg-[#D5D2CA]" />
        </div>

        {/* Header */}
        <div className="flex items-start justify-between gap-4 px-5 pt-3 sm:pt-5 pb-4 border-b border-[#ECEAE4] shrink-0">
          <div className="min-w-0">
            <h2
              id="modal-sheet-title"
              className="text-lg font-bold text-[#181715] tracking-tight truncate"
            >
              {title}
            </h2>
            {subtitle && (
              <p className="text-xs text-[#64615B] mt-0.5 truncate">{subtitle}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="min-h-[44px] min-w-[44px] -mr-2 -mt-2 flex items-center justify-center rounded-xl text-[#64615B] hover:text-[#181715] hover:bg-[#F3F1EC] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0F766E]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>

        {/* Pinned Footer */}
        {footer && (
          <div className="px-5 py-4 border-t border-[#ECEAE4] bg-[#FAF9F6] pb-safe shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
