import React, { useEffect, useId, useRef } from 'react';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl';
}

// Stacked dialogs share one scroll lock; the original overflow is restored when the last one closes.
let scrollLocks = 0;
let overflowBeforeLock = '';

function lockScroll() {
  if (scrollLocks === 0) overflowBeforeLock = document.body.style.overflow;
  scrollLocks += 1;
  document.body.style.overflow = 'hidden';
}

function unlockScroll() {
  scrollLocks -= 1;
  if (scrollLocks === 0) document.body.style.overflow = overflowBeforeLock;
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function Modal({ isOpen, onClose, title, children, footer, maxWidth = 'md' }: ModalProps) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!isOpen) return undefined;

    const opener = document.activeElement as HTMLElement | null;
    lockScroll();

    const dialog = dialogRef.current;
    const focusables = () => Array.from(dialog?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []);
    (focusables()[0] ?? dialog)?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCloseRef.current();
        return;
      }
      if (e.key !== 'Tab') return;
      const items = focusables();
      if (items.length === 0) {
        e.preventDefault();
        return;
      }
      const first = items[0] as HTMLElement;
      const last = items[items.length - 1] as HTMLElement;
      if (e.shiftKey && (document.activeElement === first || document.activeElement === dialog)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      unlockScroll();
      opener?.focus();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const widthClasses = {
    sm: 'sm:max-w-sm',
    md: 'sm:max-w-md',
    lg: 'sm:max-w-lg',
    xl: 'sm:max-w-xl',
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-navy-950/60 backdrop-blur-sm transition-opacity"
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? titleId : undefined}
    >
      {/* Background click to dismiss */}
      <div className="fixed inset-0" onClick={onClose} aria-hidden="true" />

      {/* Modal Dialog: Full-width sheet on mobile (<640px), Centered Card on desktop */}
      <div
        ref={dialogRef}
        tabIndex={-1}
        className={`relative w-full ${widthClasses[maxWidth]} bg-surface rounded-t-[16px] sm:rounded-card shadow-xl overflow-hidden flex flex-col max-h-[90dvh] sm:max-h-[85vh] z-10 border border-border`}
      >
        {/* Mobile handle indicator */}
        <div
          className="sm:hidden w-10 h-1 bg-border rounded-full mx-auto my-2 shrink-0"
          aria-hidden="true"
        />

        {/* Header */}
        {title && (
          <div className="flex items-center justify-between px-6 py-4 border-b border-border">
            <h2 id={titleId} className="text-base sm:text-lg font-semibold text-text">
              {title}
            </h2>
            <button
              onClick={onClose}
              className="p-1 rounded-md text-text-muted hover:bg-surface-muted hover:text-text min-h-[44px] min-w-[44px] flex items-center justify-center"
              aria-label="Close modal"
            >
              <svg className="w-5 h-5 fill-current" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
          </div>
        )}

        {/* Body */}
        <div className="px-6 py-4 overflow-y-auto flex-1 text-text">{children}</div>

        {/* Footer */}
        {footer && (
          <div className="px-6 py-4 bg-surface-muted border-t border-border flex justify-end gap-3">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
