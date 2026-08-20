import { useEffect, useRef, type ReactNode } from 'react';
import { Button, Modal, buttonClass } from './ui';
import { tick } from '../lib/sound';

/**
 * THE GATE. One warning, standing before every major action — removing a
 * piece, a place, a wardrobe, the whole device's record.
 *
 * Three rules, owner's order of 2026-08-19:
 *
 *  1. The body states plainly what is lost, naming the thing — and tells the
 *     truth about recovery: "There is no undo" ONLY where none exists; where
 *     an Undo toast follows (pieces, places), say so. Never a vague
 *     "Are you sure?".
 *  2. Cancel is the safe default: it holds focus when the sheet opens, and
 *     Escape (via the house Modal) closes without confirming. Enter, pressed
 *     idly, keeps things as they were.
 *  3. The confirm button wears the house destructive fill
 *     (`--color-danger-fill`, via Button tone="destructive") when `danger` is
 *     set. NOT the carmine — `--color-seal` is the mark, never the interface,
 *     and paints exactly four named things (brand contract §2).
 *
 * Built over the house Modal, which already traps focus, closes on Escape and
 * on an overlay press, and presents as a bottom sheet on a phone. This file
 * adds only the two buttons and the focus order.
 */
export default function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel,
  cancelLabel = 'Keep it',
  danger,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  body: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  // The Modal's own effect focuses the FIRST focusable thing in its sheet
  // (the header close button). This effect belongs to the PARENT component,
  // so it flushes after the Modal's — and the cancel button ends up holding
  // focus, which is what makes it the default.
  useEffect(() => {
    if (!open) return;
    cancelRef.current?.focus();
  }, [open]);

  return (
    <Modal open={open} onClose={onClose} title={title}>
      <div className="space-y-5">
        <div className="text-[14px] text-text-2 leading-relaxed">{body}</div>
        {/* Destructive at left, escape at right — the order Settings, Closet
            and ItemDetail trained the whole app's muscle memory on. */}
        <div className="flex flex-wrap items-center gap-3">
          <Button tone={danger ? 'destructive' : 'primary'} onClick={onConfirm}>
            {confirmLabel}
          </Button>
          {/* A plain element rather than the Button component, because it needs
              a ref to take first focus; it wears the exact same class and makes
              the same sound, so nothing distinguishes them to the eye or ear. */}
          <button
            ref={cancelRef}
            type="button"
            className={buttonClass('secondary')}
            onPointerDown={() => tick()}
            onClick={onClose}
          >
            {cancelLabel}
          </button>
        </div>
      </div>
    </Modal>
  );
}
