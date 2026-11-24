import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Loader2, Save, X } from 'lucide-react';
import { TASK_PRIORITIES, TASK_STATUSES } from '../types/task';
import type {
  Task,
  TaskLocation,
  TaskPriority,
  TaskStatus,
  UpdateTaskPayload,
} from '../types/task';
import { EMPTY_LOCATION, PlaceSearchInput } from './PlaceSearchInput';

interface EditTaskFormProps {
  task: Task | null;
  onClose: () => void;
  onSubmit: (taskId: string, payload: UpdateTaskPayload) => Promise<void>;
}

export function EditTaskForm({ task, onClose, onSubmit }: EditTaskFormProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('Medium');
  const [status, setStatus] = useState<TaskStatus>('Pending');
  const [location, setLocation] = useState<TaskLocation>(EMPTY_LOCATION);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (task) {
      setTitle(task.title);
      setDescription(task.description ?? '');
      setDueDate(task.dueDate ?? '');
      setPriority(task.priority);
      setStatus(task.status);
      setLocation({
        locationName: task.locationName,
        locationAddress: task.locationAddress,
        latitude: task.latitude,
        longitude: task.longitude,
        placeId: task.placeId,
      });
      setValidationError(null);
      setSubmitting(false);
    }
  }, [task]);

  useEffect(() => {
    if (!task) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !submitting) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [task, submitting, onClose]);

  if (!task) return null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setValidationError('Task title is required.');
      return;
    }
    if (trimmedTitle.length > 200) {
      setValidationError('Task title must be 200 characters or fewer.');
      return;
    }

    setValidationError(null);
    setSubmitting(true);
    try {
      await onSubmit(task.id, {
        title: trimmedTitle,
        description: description.trim() || null,
        dueDate: dueDate || null,
        priority,
        status,
        locationName: location.locationName,
        locationAddress: location.locationAddress,
        latitude: location.latitude,
        longitude: location.longitude,
        placeId: location.placeId,
      });
      onClose();
    } catch (error) {
      setValidationError(
        error instanceof Error
          ? error.message
          : 'Failed to update task. Please try again.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#1F1235]/40 p-4 backdrop-blur-[1px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-task-title"
      onClick={(e) => {
        if (e.target === e.currentTarget && !submitting) onClose();
      }}
    >
      <div className="w-full max-w-lg rounded-xl border border-[#E4DCF5] bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between border-b border-[#F0EBF9] pb-4">
          <h2
            id="edit-task-title"
            className="font-display text-lg font-bold text-[#1F1235]"
          >
            Edit Task
          </h2>
          <button
            type="button"
            disabled={submitting}
            onClick={onClose}
            aria-label="Close modal"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-[#5B4F73] hover:bg-[#F3EFFC] hover:text-[#1F1235] transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4" noValidate>
          {validationError && (
            <div
              role="alert"
              className="rounded-lg border border-[#FECDD3] bg-[#FFF1F2] px-3.5 py-2.5 text-sm text-[#9F1239]"
            >
              {validationError}
            </div>
          )}

          <div>
            <label
              htmlFor="edit-title"
              className="block text-sm font-medium text-[#1F1235]"
            >
              Task Title <span className="text-[#BE123C]">*</span>
            </label>
            <input
              id="edit-title"
              type="text"
              required
              maxLength={200}
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                if (validationError) setValidationError(null);
              }}
              className="mt-1.5 h-10 w-full rounded-lg border border-[#E4DCF5] bg-[#FAF8FF] px-3.5 text-sm text-[#1F1235] focus:border-[#4C1D95] focus:bg-white focus:outline-none"
              autoFocus
            />
          </div>

          <div>
            <label
              htmlFor="edit-description"
              className="block text-sm font-medium text-[#1F1235]"
            >
              Description
            </label>
            <textarea
              id="edit-description"
              rows={3}
              maxLength={2000}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add notes or details..."
              className="mt-1.5 w-full rounded-lg border border-[#E4DCF5] bg-[#FAF8FF] px-3.5 py-2.5 text-sm text-[#1F1235] placeholder:text-[#7E709B] focus:border-[#4C1D95] focus:bg-white focus:outline-none"
            />
          </div>

          <div>
            <span className="block text-sm font-medium text-[#1F1235] mb-1.5">
              Location (Optional)
            </span>
            <PlaceSearchInput value={location} onChange={setLocation} />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label
                htmlFor="edit-due-date"
                className="block text-sm font-medium text-[#1F1235]"
              >
                Due Date
              </label>
              <input
                id="edit-due-date"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="mt-1.5 h-10 w-full rounded-lg border border-[#E4DCF5] bg-[#FAF8FF] px-3 text-sm text-[#1F1235] focus:border-[#4C1D95] focus:bg-white focus:outline-none"
              />
            </div>

            <div>
              <label
                htmlFor="edit-priority"
                className="block text-sm font-medium text-[#1F1235]"
              >
                Priority
              </label>
              <select
                id="edit-priority"
                value={priority}
                onChange={(e) => setPriority(e.target.value as TaskPriority)}
                className="mt-1.5 h-10 w-full rounded-lg border border-[#E4DCF5] bg-[#FAF8FF] px-3 text-sm text-[#1F1235] focus:border-[#4C1D95] focus:bg-white focus:outline-none cursor-pointer"
              >
                {TASK_PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="edit-status"
                className="block text-sm font-medium text-[#1F1235]"
              >
                Status
              </label>
              <select
                id="edit-status"
                value={status}
                onChange={(e) => setStatus(e.target.value as TaskStatus)}
                className="mt-1.5 h-10 w-full rounded-lg border border-[#E4DCF5] bg-[#FAF8FF] px-3 text-sm text-[#1F1235] focus:border-[#4C1D95] focus:bg-white focus:outline-none cursor-pointer"
              >
                {TASK_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 border-t border-[#F0EBF9] pt-4">
            <button
              type="button"
              disabled={submitting}
              onClick={onClose}
              className="inline-flex h-10 items-center rounded-lg border border-[#E4DCF5] bg-white px-4 text-sm font-medium text-[#1F1235] hover:bg-[#F3EFFC] transition-colors cursor-pointer disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#3B0764] px-5 text-sm font-semibold text-white hover:bg-[#4C1D95] transition-colors cursor-pointer disabled:opacity-70"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Updating...</span>
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  <span>Save Changes</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
