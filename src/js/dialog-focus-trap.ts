/**
 * Shared accessible modal keyboard hook handling initial focus, Tab cycling, and Escape close.
 */
import { useEffect, type RefObject } from 'react';

interface DialogFocusTrapOptions {
  focusableSelector?: string;
  onRestoreFocus?: () => void;
}

const DEFAULT_FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Attaches initial focus placement, Escape dismissal, and Tab cycling inside an open dialog.
 *
 * @param isOpen - Whether the dialog is currently mounted/open.
 * @param dialogRef - Ref pointing to the dialog container element.
 * @param onClose - Callback invoked when the user presses Escape.
 * @param options - Optional focusable selector override and focus-restore callback.
 */
export function useDialogFocusTrap(
  isOpen: boolean,
  dialogRef: RefObject<HTMLElement | null>,
  onClose: () => void,
  options: DialogFocusTrapOptions = {}
): void {
  const selector = options.focusableSelector ?? DEFAULT_FOCUSABLE;
  const onRestoreFocus = options.onRestoreFocus;

  useEffect(() => {
    if (!isOpen) return;

    window.requestAnimationFrame(() => {
      dialogRef.current?.querySelector<HTMLElement>(selector)?.focus();
    });

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        onRestoreFocus?.();
        return;
      }
      if (event.key === 'Tab' && dialogRef.current) {
        const focusables = dialogRef.current.querySelectorAll<HTMLElement>(selector);
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, dialogRef, onClose, onRestoreFocus, selector]);
}
