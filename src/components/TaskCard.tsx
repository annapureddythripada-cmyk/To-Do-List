import {
  AlertCircle,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  Flag,
  Loader2,
  MapPin,
  Pencil,
  Trash2,
} from 'lucide-react';
import { TASK_STATUSES } from '../types/task';
import type { Task, TaskPriority, TaskStatus } from '../types/task';

interface TaskCardProps {
  task: Task;
  onEdit: (task: Task) => void;
  onDelete: (task: Task) => void;
  onStatusChange: (task: Task, status: TaskStatus) => Promise<void>;
  updatingId: string | null;
}

export function formatDueDate(dateStr: string | null): {
  label: string;
  isOverdue: boolean;
} {
  if (!dateStr) {
    return { label: 'No due date', isOverdue: false };
  }
  const today = new Date();
  const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(
    2,
    '0'
  )}-${String(today.getDate()).padStart(2, '0')}`;
  const isOverdue = dateStr < todayIso;

  const [y, m, d] = dateStr.split('-').map(Number);
  const formatted = new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
  return { label: formatted, isOverdue };
}

export function PriorityText({ priority }: { priority: TaskPriority }) {
  const styles: Record<TaskPriority, string> = {
    High: 'text-[#BE123C]',
    Medium: 'text-[#B45309]',
    Low: 'text-[#5B4F73]',
  };
  return (
    <span className={`inline-flex items-center gap-1.5 font-medium ${styles[priority]}`}>
      <Flag className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span>{priority} Priority</span>
    </span>
  );
}

export function StatusText({ status }: { status: TaskStatus }) {
  if (status === 'Completed') {
    return (
      <span className="inline-flex items-center gap-1.5 font-medium text-[#15803D]">
        <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span>Completed</span>
      </span>
    );
  }
  if (status === 'In Progress') {
    return (
      <span className="inline-flex items-center gap-1.5 font-medium text-[#6D28D9]">
        <Loader2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span>In Progress</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 font-medium text-[#B45309]">
      <Clock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span>Pending</span>
    </span>
  );
}

export function TaskCard({
  task,
  onEdit,
  onDelete,
  onStatusChange,
  updatingId,
}: TaskCardProps) {
  const isCompleted = task.status === 'Completed';
  const isUpdating = updatingId === task.id;
  const due = formatDueDate(task.dueDate);
  const showOverdue = due.isOverdue && !isCompleted;

  return (
    <article className="flex flex-col justify-between rounded-xl border border-[#E4DCF5] bg-white p-5 transition-all duration-150 hover:border-[#C4B5FD]">
      <div>
        <div className="flex items-start gap-3">
          <button
            type="button"
            disabled={isUpdating}
            onClick={() =>
              onStatusChange(task, isCompleted ? 'Pending' : 'Completed')
            }
            aria-label={
              isCompleted
                ? `Mark "${task.title}" as pending`
                : `Mark "${task.title}" as completed`
            }
            className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-colors focus-visible:outline-2 focus-visible:outline-[#4C1D95] cursor-pointer ${
              isCompleted
                ? 'border-[#15803D] bg-[#15803D] text-white'
                : 'border-[#C4B5FD] bg-[#FAF8FF] hover:border-[#4C1D95]'
            }`}
          >
            {isCompleted && <Check className="h-3.5 w-3.5" strokeWidth={2.5} />}
          </button>

          <div className="min-w-0 flex-1">
            <h3
              className={`font-display text-base font-semibold leading-snug ${
                isCompleted ? 'text-[#7E709B] line-through' : 'text-[#1F1235]'
              }`}
            >
              {task.title}
            </h3>
            {task.description && (
              <p className="mt-1.5 line-clamp-3 text-sm leading-relaxed text-[#5B4F73]">
                {task.description}
              </p>
            )}
            {task.locationName && (
              <p className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-[#4C1D95]">
                <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span className="truncate">{task.locationName}</span>
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="mt-5 border-t border-[#F0EBF9] pt-4">
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5 text-xs">
          <PriorityText priority={task.priority} />
          <span aria-hidden="true" className="text-[#C4B5FD]">
            ·
          </span>
          <StatusText status={task.status} />
          <span aria-hidden="true" className="text-[#C4B5FD]">
            ·
          </span>
          <span
            className={`inline-flex items-center gap-1.5 font-mono-tabular ${
              showOverdue ? 'font-medium text-[#BE123C]' : 'text-[#5B4F73]'
            }`}
          >
            {showOverdue ? (
              <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            ) : (
              <Calendar className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            )}
            <span>
              {due.label}
              {showOverdue ? ' (Overdue)' : ''}
            </span>
          </span>
        </div>

        <div className="mt-4 flex items-center justify-between gap-2">
          <select
            aria-label={`Change status for ${task.title}`}
            value={task.status}
            disabled={isUpdating}
            onChange={(e) =>
              onStatusChange(task, e.target.value as TaskStatus)
            }
            className="h-9 rounded-lg border border-[#E4DCF5] bg-[#FAF8FF] px-2.5 text-xs font-medium text-[#1F1235] focus:border-[#4C1D95] focus:outline-none cursor-pointer disabled:opacity-60"
          >
            {TASK_STATUSES.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => onEdit(task)}
              aria-label={`Edit ${task.title}`}
              className="inline-flex h-10 items-center gap-1.5 rounded-lg px-3 text-xs font-medium text-[#4C1D95] hover:bg-[#F3EFFC] transition-colors focus-visible:outline-2 focus-visible:outline-[#4C1D95] cursor-pointer"
            >
              <Pencil className="h-3.5 w-3.5" />
              <span>Edit</span>
            </button>
            <button
              type="button"
              onClick={() => onDelete(task)}
              aria-label={`Delete ${task.title}`}
              className="inline-flex h-10 items-center gap-1.5 rounded-lg px-3 text-xs font-medium text-[#BE123C] hover:bg-[#FFF1F2] transition-colors focus-visible:outline-2 focus-visible:outline-[#BE123C] cursor-pointer"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>Delete</span>
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}
