import {
  AlertTriangle,
  Check,
  ClipboardList,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
} from 'lucide-react';
import { TASK_STATUSES } from '../types/task';
import type { Task, TaskStatus, ViewMode } from '../types/task';
import {
  formatDueDate,
  PriorityText,
  StatusText,
  TaskCard,
} from './TaskCard';

interface TaskListProps {
  tasks: Task[];
  viewMode: ViewMode;
  loading: boolean;
  error: string | null;
  hasActiveFilters: boolean;
  onRetry: () => void;
  onOpenAddModal: () => void;
  onClearFilters: () => void;
  onEdit: (task: Task) => void;
  onDelete: (task: Task) => void;
  onStatusChange: (task: Task, status: TaskStatus) => Promise<void>;
  updatingId: string | null;
}

export function TaskList({
  tasks,
  viewMode,
  loading,
  error,
  hasActiveFilters,
  onRetry,
  onOpenAddModal,
  onClearFilters,
  onEdit,
  onDelete,
  onStatusChange,
  updatingId,
}: TaskListProps) {
  if (error) {
    return (
      <div
        role="alert"
        className="flex flex-col items-start justify-between gap-4 rounded-xl border border-[#FECDD3] bg-[#FFF1F2] p-6 sm:flex-row sm:items-center"
      >
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-[#BE123C]" />
          <div>
            <h3 className="font-display text-sm font-semibold text-[#881337]">
              Could not load tasks
            </h3>
            <p className="mt-1 text-sm text-[#9F1239]">{error}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#BE123C] px-4 text-sm font-medium text-white hover:bg-[#9F1239] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <RefreshCw className="h-4 w-4" />
          <span>Try Again</span>
        </button>
      </div>
    );
  }

  if (loading) {
    if (viewMode === 'table') {
      return (
        <div className="overflow-hidden rounded-xl border border-[#E4DCF5] bg-white">
          <div className="border-b border-[#E4DCF5] bg-[#F3EFFC] px-5 py-3">
            <div className="h-4 w-48 animate-pulse rounded bg-[#E4DCF5]" />
          </div>
          <div className="divide-y divide-[#F0EBF9]">
            {[1, 2, 3, 4].map((row) => (
              <div key={row} className="flex items-center justify-between gap-4 px-5 py-4">
                <div className="h-4 w-1/3 animate-pulse rounded bg-[#F3EFFC]" />
                <div className="h-4 w-24 animate-pulse rounded bg-[#F3EFFC]" />
                <div className="h-4 w-24 animate-pulse rounded bg-[#F3EFFC]" />
                <div className="h-4 w-20 animate-pulse rounded bg-[#F3EFFC]" />
              </div>
            ))}
          </div>
        </div>
      );
    }

    return (
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {[1, 2, 3].map((item) => (
          <div
            key={item}
            className="rounded-xl border border-[#E4DCF5] bg-white p-5 space-y-4"
          >
            <div className="h-5 w-3/4 animate-pulse rounded bg-[#F3EFFC]" />
            <div className="h-4 w-full animate-pulse rounded bg-[#F3EFFC]" />
            <div className="h-4 w-2/3 animate-pulse rounded bg-[#F3EFFC]" />
            <div className="border-t border-[#F0EBF9] pt-4 flex justify-between">
              <div className="h-8 w-24 animate-pulse rounded bg-[#F3EFFC]" />
              <div className="h-8 w-28 animate-pulse rounded bg-[#F3EFFC]" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (tasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-[#E4DCF5] bg-white px-6 py-16 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#F3EFFC] text-[#4C1D95]">
          <ClipboardList className="h-6 w-6" />
        </div>
        <h3 className="mt-4 font-display text-lg font-semibold text-[#1F1235]">
          {hasActiveFilters ? 'No matching tasks found' : 'No tasks yet'}
        </h3>
        <p className="mt-1.5 max-w-md text-sm text-[#5B4F73]">
          {hasActiveFilters
            ? 'Try adjusting your search query or priority and status filters to see more tasks.'
            : 'Create your first task with a title, due date, and priority to start organizing your work.'}
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          {hasActiveFilters && (
            <button
              type="button"
              onClick={onClearFilters}
              className="inline-flex h-10 items-center rounded-lg border border-[#E4DCF5] bg-white px-4 text-sm font-medium text-[#1F1235] hover:bg-[#F3EFFC] transition-colors cursor-pointer"
            >
              Reset Filters
            </button>
          )}
          <button
            type="button"
            onClick={onOpenAddModal}
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#3B0764] px-4 text-sm font-semibold text-white hover:bg-[#4C1D95] transition-colors cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span>Add First Task</span>
          </button>
        </div>
      </div>
    );
  }

  if (viewMode === 'table') {
    return (
      <div className="overflow-hidden rounded-xl border border-[#E4DCF5] bg-white">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-[#E4DCF5] bg-[#F3EFFC] text-xs font-semibold text-[#3B0764]">
                <th className="px-5 py-3.5">Task</th>
                <th className="px-4 py-3.5 whitespace-nowrap">Priority</th>
                <th className="px-4 py-3.5 whitespace-nowrap">Status</th>
                <th className="px-4 py-3.5 whitespace-nowrap">Due Date</th>
                <th className="px-5 py-3.5 text-right whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F0EBF9]">
              {tasks.map((task) => {
                const isCompleted = task.status === 'Completed';
                const isUpdating = updatingId === task.id;
                const due = formatDueDate(task.dueDate);
                const showOverdue = due.isOverdue && !isCompleted;

                return (
                  <tr
                    key={task.id}
                    className="transition-colors hover:bg-[#FAF8FF]"
                  >
                    <td className="px-5 py-3.5 max-w-md">
                      <div className="flex items-start gap-3">
                        <button
                          type="button"
                          disabled={isUpdating}
                          onClick={() =>
                            onStatusChange(
                              task,
                              isCompleted ? 'Pending' : 'Completed'
                            )
                          }
                          aria-label={
                            isCompleted
                              ? `Mark "${task.title}" as pending`
                              : `Mark "${task.title}" as completed`
                          }
                          className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-colors cursor-pointer ${
                            isCompleted
                              ? 'border-[#15803D] bg-[#15803D] text-white'
                              : 'border-[#C4B5FD] bg-white hover:border-[#4C1D95]'
                          }`}
                        >
                          {isCompleted && (
                            <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
                          )}
                        </button>
                        <div className="min-w-0">
                          <p
                            className={`font-medium ${
                              isCompleted
                                ? 'text-[#7E709B] line-through'
                                : 'text-[#1F1235]'
                            }`}
                          >
                            {task.title}
                          </p>
                          {task.description && (
                            <p className="mt-0.5 truncate text-xs text-[#5B4F73] max-w-sm">
                              {task.description}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-xs whitespace-nowrap">
                      <PriorityText priority={task.priority} />
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <select
                          aria-label={`Status for ${task.title}`}
                          value={task.status}
                          disabled={isUpdating}
                          onChange={(e) =>
                            onStatusChange(task, e.target.value as TaskStatus)
                          }
                          className="h-8 rounded-md border border-[#E4DCF5] bg-[#FAF8FF] px-2 text-xs font-medium text-[#1F1235] focus:border-[#4C1D95] focus:outline-none cursor-pointer"
                        >
                          {TASK_STATUSES.map((status) => (
                            <option key={status} value={status}>
                              {status}
                            </option>
                          ))}
                        </select>
                        <span className="sr-only">
                          <StatusText status={task.status} />
                        </span>
                      </div>
                    </td>
                    <td
                      className={`px-4 py-3.5 font-mono-tabular text-xs whitespace-nowrap ${
                        showOverdue ? 'font-medium text-[#BE123C]' : 'text-[#5B4F73]'
                      }`}
                    >
                      {due.label}
                      {showOverdue ? ' (Overdue)' : ''}
                    </td>
                    <td className="px-5 py-3.5 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => onEdit(task)}
                          aria-label={`Edit ${task.title}`}
                          className="inline-flex h-9 items-center gap-1 rounded-lg px-2.5 text-xs font-medium text-[#4C1D95] hover:bg-[#F3EFFC] transition-colors cursor-pointer"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          <span>Edit</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => onDelete(task)}
                          aria-label={`Delete ${task.title}`}
                          className="inline-flex h-9 items-center gap-1 rounded-lg px-2.5 text-xs font-medium text-[#BE123C] hover:bg-[#FFF1F2] transition-colors cursor-pointer"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          <span>Delete</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      {tasks.map((task) => (
        <TaskCard
          key={task.id}
          task={task}
          onEdit={onEdit}
          onDelete={onDelete}
          onStatusChange={onStatusChange}
          updatingId={updatingId}
        />
      ))}
    </div>
  );
}
