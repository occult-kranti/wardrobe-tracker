import { useState, useEffect } from 'react';
import { CheckCircle, AlertCircle, Info } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info';

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

export function showToast(message: string, type: ToastType = 'info') {
  const id = Math.random().toString(36).slice(2);
  toasts = [...toasts, { id, message, type }];
  notify();
  setTimeout(() => {
    toasts = toasts.filter(t => t.id !== id);
    notify();
  }, 3000);
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

const iconMap = {
  success: CheckCircle,
  error: AlertCircle,
  info: Info,
};

const colorMap = {
  success: 'bg-success/10 text-success border-success/20',
  error: 'bg-error/10 text-error border-error/20',
  info: 'bg-accent/10 text-accent border-accent/20',
};

export function ToastContainer() {
  const toasts = useToasts();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[200] flex flex-col gap-2 w-[90%] max-w-sm">
      {toasts.map(toast => {
        const Icon = iconMap[toast.type];
        return (
          <div
            key={toast.id}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl border shadow-lg backdrop-blur-md animate-in slide-in-from-bottom-2 ${colorMap[toast.type]}`}
          >
            <Icon size={18} />
            <p className="text-sm font-medium flex-1">{toast.message}</p>
          </div>
        );
      })}
    </div>
  );
}
