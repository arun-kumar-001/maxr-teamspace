import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

const MENU_WIDTH = 176;
const GAP = 4;
const EDGE = 8;

function Svg({ children, strokeWidth = 1.8 }: { children: ReactNode; strokeWidth?: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4 shrink-0"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

const IconMoreVertical = () => (
  <Svg strokeWidth={2}>
    <circle cx="12" cy="12" r="1.2" fill="currentColor" />
    <circle cx="12" cy="5" r="1.2" fill="currentColor" />
    <circle cx="12" cy="19" r="1.2" fill="currentColor" />
  </Svg>
);

const IconEye = () => (
  <Svg>
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
    <circle cx="12" cy="12" r="3" />
  </Svg>
);

const IconEditPencil = () => (
  <Svg>
    <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
  </Svg>
);

const IconPower = () => (
  <Svg>
    <path d="M18.36 6.64a9 9 0 1 1-12.73 0" />
    <line x1="12" y1="2" x2="12" y2="12" />
  </Svg>
);

interface EmployeeActionsMenuProps {
  employeeId: string;
  employeeName: string;
  canEdit: boolean;
  canDeactivate: boolean;
  onView: () => void;
  onEdit: () => void;
  onDeactivate: () => void;
}

/**
 * Three-dot row menu shared by the card and table views. The list is drawn in a portal at the page
 * level, so a table container that scrolls or clips can never cut it off, and it opens upward when
 * there is no room below the button.
 */
export function EmployeeActionsMenu({
  employeeId,
  employeeName,
  canEdit,
  canDeactivate,
  onView,
  onEdit,
  onDeactivate,
}: EmployeeActionsMenuProps) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const close = useCallback((restoreFocus: boolean) => {
    setOpen(false);
    setPosition(null);
    if (restoreFocus) triggerRef.current?.focus();
  }, []);

  // Measure the open menu, then place it under the button (or above it near the bottom of the screen).
  useLayoutEffect(() => {
    if (!open) return;
    const trigger = triggerRef.current;
    const menu = menuRef.current;
    if (!trigger || !menu) return;
    const rect = trigger.getBoundingClientRect();
    const height = menu.offsetHeight;
    const left = Math.min(
      Math.max(EDGE, rect.right - MENU_WIDTH),
      window.innerWidth - MENU_WIDTH - EDGE,
    );
    const below = rect.bottom + GAP;
    const top =
      below + height + EDGE > window.innerHeight ? Math.max(EDGE, rect.top - GAP - height) : below;
    setPosition({ top, left });
  }, [open]);

  useEffect(() => {
    if (open && position) menuRef.current?.querySelector('button')?.focus();
  }, [open, position]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (menuRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
      close(false);
    };
    const dismiss = () => close(false);
    document.addEventListener('mousedown', onPointerDown);
    window.addEventListener('resize', dismiss);
    window.addEventListener('scroll', dismiss, true);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      window.removeEventListener('resize', dismiss);
      window.removeEventListener('scroll', dismiss, true);
    };
  }, [open, close]);

  const run = (action: () => void) => {
    close(false);
    action();
  };

  const onMenuKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      close(true);
      return;
    }
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    const items = Array.from(menuRef.current?.querySelectorAll('button') ?? []);
    const index = items.indexOf(document.activeElement as HTMLButtonElement);
    const step = event.key === 'ArrowDown' ? 1 : -1;
    items[(index + step + items.length) % items.length]?.focus();
    event.preventDefault();
  };

  const itemClass =
    'flex min-h-[44px] w-full cursor-pointer items-center gap-2.5 px-3.5 py-2 text-left text-sm font-medium transition-colors';

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => (open ? close(false) : setOpen(true))}
        aria-label={`Actions for ${employeeName}`}
        aria-expanded={open}
        className="inline-flex min-h-[44px] min-w-[44px] cursor-pointer items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-surface-muted hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-strong"
      >
        <IconMoreVertical />
      </button>

      {open &&
        createPortal(
          <div
            ref={menuRef}
            role="group"
            aria-label="Employee actions"
            onKeyDown={onMenuKeyDown}
            style={
              position
                ? { top: position.top, left: position.left, width: MENU_WIDTH }
                : { top: 0, left: 0, width: MENU_WIDTH, visibility: 'hidden' }
            }
            className="fixed z-50 overflow-hidden rounded-xl border border-border bg-surface-raised py-1 shadow-lg"
          >
            <button
              type="button"
              onClick={() => run(onView)}
              className={`${itemClass} text-text hover:bg-surface-muted hover:text-primary-ink`}
            >
              <span className="text-text-muted">
                <IconEye />
              </span>
              <span>View Details</span>
            </button>

            {canEdit && (
              <button
                type="button"
                onClick={() => run(onEdit)}
                className={`${itemClass} text-text hover:bg-surface-muted hover:text-primary-ink`}
              >
                <span className="text-text-muted">
                  <IconEditPencil />
                </span>
                <span>Edit Employee</span>
              </button>
            )}

            {canDeactivate && (
              <button
                type="button"
                onClick={() => run(onDeactivate)}
                data-testid={`deactivate-btn-table-${employeeId}`}
                className={`${itemClass} border-t border-border text-negative-ink hover:bg-negative-soft`}
              >
                <IconPower />
                <span>Deactivate</span>
              </button>
            )}
          </div>,
          document.body,
        )}
    </>
  );
}
