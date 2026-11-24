import { useEffect } from 'react';
import { AlertTriangle, Loader2, Trash2, X } from 'lucide-react';
import type { Task } from '../types/task';

interface ConfirmationModalProps {
  task: Task | null;
  deleting: boolean;
  onCancel: () => void;
  onConfirm: () => Promise<void>;
}

export function ConfirmationModal({
  task,
  deleting,
  onCancel,
  onConfirm,
}: ConfirmationModalProps) {
  useEffect(() => {
    if (!task) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !deleting) {
        onCancel();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [task, deleting, onCancel]);

  if (!task) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#1F1235]/40 p-4 backdrop-blur-[1px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget && !deleting) onCancel();
      }}
    >
      <div className="w-full max-w-md rounded-xl border border-[#E4DCF5] bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#FFF1F2] text-[#BE123C]">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <h2
                id="delete-modal-title"
                className="font-display text-base font-bold text-[#1F1235]"
              >
                Delete Task
              </h2>
              <p className="mt-1.5 text-sm leading-relaxed text-[#5B4F73]">
                Are you sure you want to permanently delete{' '}
                <span className="font-semibold text-[#1F1235]">
                  &ldquo;{task.title}&rdquo;
                </span>
                ? This action cannot be undone.
              </p>
            </div>
          </div>
          <button
            type="button"
            disabled={deleting}
            onClick={onCancel}
            aria-label="Close confirmation dialog"
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[#5B4F73] hover:bg-[#F3EFFC] transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-6 flex items-center justify-end gap-3 border-t border-[#F0EBF9] pt-4">
          <button
            type="button"
            disabled={deleting}
            onClick={onCancel}
            className="inline-flex h-10 items-center rounded-lg border border-[#E4DCF5] bg-white px-4 text-sm font-medium text-[#1F1235] hover:bg-[#F3EFFC] transition-colors cursor-pointer disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={deleting}
            onClick={onConfirm}
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#BE123C] px-4 text-sm font-semibold text-white hover:bg-[#9F1239] transition-colors cursor-pointer disabled:opacity-70"
          >
            {deleting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Deleting...</span>
              </>
            ) : (
              <>
                <Trash2 className="h-4 w-4" />
                <span>Delete Permanently</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
