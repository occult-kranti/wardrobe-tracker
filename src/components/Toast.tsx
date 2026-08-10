import { useState, useEffect } from 'react';
import { X, CheckCircle, AlertCircle, Info } from 'lucide-react';

interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

let toastListeners: ((toasts: Toast[]) => void)[] = [];
let toasts: Toast[] = [];

function notify() {
  toastListeners.forEach(l => l([...toasts]));
}

export function showToast(message: string, type: Toast['type'] = 'info') {
  const id = Math.random().toString(36).slice(2);
  toasts = [...toasts, { id, message, type }];
  notify();
  setTimeout(() => {
    toasts = toasts.filter(t => t.id !== id);
    notify();
  }, 3000);
}

export function useToasts() {
  const [localToasts, setLocalToasts] = useState<Toast[]>([]);
  useEffect(() => {
    const listener = (t: Toast[]) => setLocalToasts(t);
    toastListeners.push(listener);
    return () => {
      toastListeners = toastListeners.filter(l => l !== listener);
    };
  }, []);
  return localToasts;
}

const icons = {
  success: CheckCircle,
  error: AlertCircle,
  info: Info,
};

const toastStyles = {
  success: 'border-sage/30 bg-bg-card text-sage',
  error: 'border-error/30 bg-bg-card text-error',
  info: 'border-accent/30 bg-bg-card text-accent',
};

export function ToastContainer() {
  const toasts = useToasts();
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[200] flex flex-col gap-2">
      {toasts.map(toast => {
        const Icon = icons[toast.type];
        return (
          <div
            key={toast.id}
            className={`flex items-center gap-2.5 px-4 py-3 rounded-lg border shadow-lg shadow-black/20 backdrop-blur-sm min-w-[280px] max-w-md ${toastStyles[toast.type]}`}
          >
            <Icon size={16} className="flex-shrink-0" />
            <p className="text-sm font-medium flex-1">{toast.message}</p>
            <button
              onClick={() => {
                /* dismiss handled by timeout */
              }}
              className="flex-shrink-0 opacity-50 hover:opacity-100 transition-opacity"
            >
              <X size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
