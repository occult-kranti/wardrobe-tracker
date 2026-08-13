import { useState, useEffect } from 'react';
import { chime } from '../lib/sound';
import { IconCheck, IconEyeletFilled } from './icons';

export type ToastType = 'success' | 'error' | 'info' | 'seal';

interface Toast {
  id: string;
  message: string;
  type: ToastType;
  /** An offer attached to the news, e.g. putting back what was just removed. */
  action?: { label: string; run: () => void };
}

let toastListeners: ((toasts: Toast[]) => void)[] = [];
let toasts: Toast[] = [];

function notify() {
  toastListeners.forEach(l => l([...toasts]));
}

/**
 * Voice: dry, two beats, verb first. "Logged. Worn 14 times."
 * The 'seal' type is reserved for wear logging — it presses like a wax seal.
 */
export function showToast(
  message: string,
  type: ToastType = 'info',
  action?: { label: string; run: () => void },
) {
  // The house confirms in a windchime; errors stay silent — bad news does
  // not get music.
  if (type !== 'error') chime();
  const id = Math.random().toString(36).slice(2);
  toasts = [...toasts, { id, message, type, action }];
  notify();
  // An offer needs long enough to be read and reached for; plain news does not.
  setTimeout(() => {
    toasts = toasts.filter(t => t.id !== id);
    notify();
  }, action ? 9000 : 4000);
}

/** Take a toast down early — used when its offer has been accepted. */
function dismiss(id: string) {
  toasts = toasts.filter(t => t.id !== id);
  notify();
}

export function useToasts() {
  const [state, setState] = useState<Toast[]>([]);
  useEffect(() => {
    toastListeners.push(setState);
    return () => {
      toastListeners = toastListeners.filter(l => l !== setState);
    };
  }, []);
  return state;
}

export function ToastContainer() {
  const items = useToasts();
  if (items.length === 0) return null;

  return (
    <div
      className="fixed above-rail-toast lg:bottom-4 left-4 right-4 sm:right-auto z-[200] flex flex-col gap-2 sm:max-w-sm"
      role="status"
      aria-live="polite"
    >
      {items.map(toast => (
        <div
          key={toast.id}
          className="flex items-center gap-3 px-4 py-3 bg-surface plate-ink rounded-[2px] animate-slip"
        >
          <span className={toast.type === 'error' ? 'text-danger' : 'text-accent'}>
            {toast.type === 'seal' ? (
              <span className="inline-block animate-seal">
                <IconEyeletFilled size={14} />
              </span>
            ) : (
              <IconCheck size={16} />
            )}
          </span>
          <p className="text-[14px] text-text flex-1">{toast.message}</p>
          {toast.action ? (
            <button
              type="button"
              onClick={() => {
                toast.action!.run();
                dismiss(toast.id);
              }}
              className="type-label text-[11px] text-accent underline underline-offset-[3px] shrink-0 min-h-11 px-1"
            >
              {toast.action.label}
            </button>
          ) : null}
        </div>
      ))}
    </div>
  );
}
