import { AlertCircle, CheckCircle2, X } from 'lucide-react';
import type { ToastMessage } from '../types/task';

interface ToastContainerProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export function ToastContainer({ toasts, onDismiss }: ToastContainerProps) {
  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      className="fixed bottom-4 right-4 z-50 flex w-full max-w-sm flex-col gap-2.5 px-4 sm:px-0"
    >
      {toasts.map((toast) => {
        const isSuccess = toast.type === 'success';
        return (
          <div
            key={toast.id}
            role="status"
            className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-3 shadow-lg ${
              isSuccess
                ? 'border-[#BBF7D0] bg-white text-[#14532D]'
                : 'border-[#FECDD3] bg-white text-[#881337]'
            }`}
          >
            <div className="flex items-center gap-2.5 text-sm font-medium">
              {isSuccess ? (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-[#15803D]" />
              ) : (
                <AlertCircle className="h-4 w-4 shrink-0 text-[#BE123C]" />
              )}
              <span>{toast.message}</span>
            </div>
            <button
              type="button"
              onClick={() => onDismiss(toast.id)}
              aria-label="Dismiss notification"
              className="rounded p-1 text-[#5B4F73] hover:bg-[#F3EFFC] hover:text-[#1F1235] cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
