import { LayoutGrid, Search, Table2, X } from 'lucide-react';
import { TASK_PRIORITIES, TASK_STATUSES } from '../types/task';
import type { ViewMode } from '../types/task';

interface SearchAndFilterProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  priorityFilter: string;
  onPriorityChange: (value: string) => void;
  statusFilter: string;
  onStatusChange: (value: string) => void;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  lockStatusFilter?: boolean;
}

export function SearchAndFilter({
  searchQuery,
  onSearchChange,
  priorityFilter,
  onPriorityChange,
  statusFilter,
  onStatusChange,
  viewMode,
  onViewModeChange,
  lockStatusFilter = false,
}: SearchAndFilterProps) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-[#E4DCF5] bg-white p-4 lg:flex-row lg:items-center lg:justify-between">
      <div className="relative flex-1">
        <Search
          className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6D5F8A]"
          aria-hidden="true"
        />
        <input
          type="search"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search tasks by title or description..."
          aria-label="Search tasks"
          className="h-10 w-full rounded-lg border border-[#E4DCF5] bg-[#FAF8FF] pl-10 pr-9 text-sm text-[#1F1235] placeholder:text-[#7E709B] focus:border-[#4C1D95] focus:bg-white focus:outline-none transition-colors"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => onSearchChange('')}
            aria-label="Clear search"
            className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-1 text-[#6D5F8A] hover:bg-[#F3EFFC] hover:text-[#1F1235] cursor-pointer"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <label
            htmlFor="priority-filter"
            className="text-xs font-medium text-[#5B4F73] whitespace-nowrap"
          >
            Priority
          </label>
          <select
            id="priority-filter"
            value={priorityFilter}
            onChange={(e) => onPriorityChange(e.target.value)}
            className="h-10 rounded-lg border border-[#E4DCF5] bg-[#FAF8FF] px-3 text-sm text-[#1F1235] focus:border-[#4C1D95] focus:bg-white focus:outline-none cursor-pointer"
          >
            <option value="All">All Priorities</option>
            {TASK_PRIORITIES.map((priority) => (
              <option key={priority} value={priority}>
                {priority}
              </option>
            ))}
          </select>
        </div>

        {!lockStatusFilter && (
          <div className="flex items-center gap-2">
            <label
              htmlFor="status-filter"
              className="text-xs font-medium text-[#5B4F73] whitespace-nowrap"
            >
              Status
            </label>
            <select
              id="status-filter"
              value={statusFilter}
              onChange={(e) => onStatusChange(e.target.value)}
              className="h-10 rounded-lg border border-[#E4DCF5] bg-[#FAF8FF] px-3 text-sm text-[#1F1235] focus:border-[#4C1D95] focus:bg-white focus:outline-none cursor-pointer"
            >
              <option value="All">All Statuses</option>
              {TASK_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </div>
        )}

        <div
          role="group"
          aria-label="View layout"
          className="inline-flex items-center rounded-lg border border-[#E4DCF5] bg-[#F3EFFC] p-1"
        >
          <button
            type="button"
            onClick={() => onViewModeChange('cards')}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              viewMode === 'cards'
                ? 'bg-white text-[#3B0764] shadow-xs'
                : 'text-[#5B4F73] hover:text-[#1F1235]'
            }`}
          >
            <LayoutGrid className="h-3.5 w-3.5" />
            <span>Cards</span>
          </button>
          <button
            type="button"
            onClick={() => onViewModeChange('table')}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              viewMode === 'table'
                ? 'bg-white text-[#3B0764] shadow-xs'
                : 'text-[#5B4F73] hover:text-[#1F1235]'
            }`}
          >
            <Table2 className="h-3.5 w-3.5" />
            <span>Table</span>
          </button>
        </div>
      </div>
    </div>
  );
}
