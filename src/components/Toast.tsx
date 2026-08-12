import { useState, useEffect } from 'react';
import { chime } from '../lib/sound';
import { IconCheck, IconEyeletFilled } from './icons';

export type ToastType = 'success' | 'error' | 'info' | 'seal';

interface Toast {
  id: string;
  message: string;
  type: ToastType;
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
export function showToast(message: string, type: ToastType = 'info') {
  // The house confirms in a windchime; errors stay silent — bad news does
  // not get music.
  if (type !== 'error') chime();
  const id = Math.random().toString(36).slice(2);
  toasts = [...toasts, { id, message, type }];
  notify();
  setTimeout(() => {
    toasts = toasts.filter(t => t.id !== id);
    notify();
  }, 4000);
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
      className="fixed bottom-[72px] lg:bottom-4 left-4 right-4 sm:right-auto z-[200] flex flex-col gap-2 sm:max-w-sm"
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
        </div>
      ))}
    </div>
  );
}
