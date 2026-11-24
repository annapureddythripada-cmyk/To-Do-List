import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, Menu, Plus } from 'lucide-react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Sidebar } from './components/Sidebar';
import { Dashboard } from './components/Dashboard';
import { SearchAndFilter } from './components/SearchAndFilter';
import { TaskList } from './components/TaskList';
import { AddTaskForm } from './components/AddTaskForm';
import { EditTaskForm } from './components/EditTaskForm';
import { ConfirmationModal } from './components/ConfirmationModal';
import { ToastContainer } from './components/Toast';
import { SignInView } from './components/SignInView';
import {
  createTask,
  deleteTask,
  fetchTasks,
  updateTask,
} from './services/taskApi';
import type {
  CreateTaskPayload,
  NavSection,
  Task,
  TaskStats,
  TaskStatus,
  ToastMessage,
  UpdateTaskPayload,
  ViewMode,
} from './types/task';

const EMPTY_STATS: TaskStats = {
  total: 0,
  pending: 0,
  inProgress: 0,
  completed: 0,
};

function TaskWorkspace() {
  const { user, loading: authLoading, authError, signInWithGoogle, signOutUser, getToken } =
    useAuth();

  const [tasks, setTasks] = useState<Task[]>([]);
  const [stats, setStats] = useState<TaskStats>(EMPTY_STATS);
  const [loadingTasks, setLoadingTasks] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [activeSection, setActiveSection] = useState<NavSection>('dashboard');
  const [searchQuery, setSearchQuery] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [viewMode, setViewMode] = useState<ViewMode>('cards');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [deletingTask, setDeletingTask] = useState<Task | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [updatingTaskId, setUpdatingTaskId] = useState<string | null>(null);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const pushToast = useCallback(
    (type: 'success' | 'error', message: string) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      setToasts((prev) => [...prev, { id, type, message }]);
      window.setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 3600);
    },
    []
  );

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const loadTasks = useCallback(async () => {
    if (!user) return;
    setLoadingTasks(true);
    setFetchError(null);
    try {
      const token = await getToken();
      const data = await fetchTasks(token);
      setTasks(data.tasks);
      setStats(data.stats);
    } catch (error) {
      setFetchError(
        error instanceof Error ? error.message : 'Unable to load tasks.'
      );
    } finally {
      setLoadingTasks(false);
    }
  }, [user, getToken]);

  useEffect(() => {
    if (user) {
      loadTasks();
    } else {
      setTasks([]);
      setStats(EMPTY_STATS);
    }
  }, [user, loadTasks]);

  const handleSelectSection = (section: NavSection) => {
    setActiveSection(section);
    if (section === 'completed') {
      setStatusFilter('Completed');
    } else if (section === 'pending') {
      setStatusFilter('All');
    } else {
      setStatusFilter('All');
    }
  };

  const handleCreateTask = async (payload: CreateTaskPayload) => {
    const token = await getToken();
    await createTask(token, payload);
    await loadTasks();
    pushToast('success', 'Task added successfully.');
  };

  const handleUpdateTask = async (
    taskId: string,
    payload: UpdateTaskPayload
  ) => {
    const token = await getToken();
    await updateTask(token, taskId, payload);
    await loadTasks();
    pushToast('success', 'Task updated successfully.');
  };

  const handleQuickStatusChange = async (task: Task, status: TaskStatus) => {
    setUpdatingTaskId(task.id);
    try {
      const token = await getToken();
      await updateTask(token, task.id, { status });
      await loadTasks();
      pushToast('success', `Marked "${task.title}" as ${status}.`);
    } catch (error) {
      pushToast(
        'error',
        error instanceof Error ? error.message : 'Failed to update task status.'
      );
    } finally {
      setUpdatingTaskId(null);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingTask) return;
    setIsDeleting(true);
    try {
      const token = await getToken();
      await deleteTask(token, deletingTask.id);
      setDeletingTask(null);
      await loadTasks();
      pushToast('success', 'Task deleted permanently.');
    } catch (error) {
      pushToast(
        'error',
        error instanceof Error ? error.message : 'Failed to delete task.'
      );
    } finally {
      setIsDeleting(false);
    }
  };

  const filteredTasks = useMemo(() => {
    const search = searchQuery.trim().toLowerCase();
    return tasks.filter((task) => {
      if (activeSection === 'completed' && task.status !== 'Completed') {
        return false;
      }
      if (activeSection === 'pending' && task.status === 'Completed') {
        return false;
      }
      if (
        activeSection !== 'completed' &&
        activeSection !== 'pending' &&
        statusFilter !== 'All' &&
        task.status !== statusFilter
      ) {
        return false;
      }
      if (priorityFilter !== 'All' && task.priority !== priorityFilter) {
        return false;
      }
      if (search) {
        const text = `${task.title} ${task.description ?? ''}`.toLowerCase();
        if (!text.includes(search)) {
          return false;
        }
      }
      return true;
    });
  }, [tasks, activeSection, statusFilter, priorityFilter, searchQuery]);

  const hasActiveFilters =
    searchQuery.trim() !== '' ||
    priorityFilter !== 'All' ||
    (activeSection !== 'completed' &&
      activeSection !== 'pending' &&
      statusFilter !== 'All');

  const clearFilters = () => {
    setSearchQuery('');
    setPriorityFilter('All');
    if (activeSection !== 'completed' && activeSection !== 'pending') {
      setStatusFilter('All');
    }
  };

  const sectionHeading: Record<NavSection, { title: string; subtitle: string }> = {
    dashboard: {
      title: 'Workspace Overview',
      subtitle: 'Track task progress, deadlines, and priorities at a glance.',
    },
    all: {
      title: 'All Tasks',
      subtitle: 'Complete list of tasks across every priority and stage.',
    },
    pending: {
      title: 'Pending & Active Tasks',
      subtitle: 'Items waiting to start or currently in progress.',
    },
    completed: {
      title: 'Completed Tasks',
      subtitle: 'Finished tasks archived for your reference.',
    },
  };

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FAF8FF]">
        <div className="flex items-center gap-3 text-sm font-medium text-[#4C1D95]">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>Loading workspace...</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return <SignInView onSignIn={signInWithGoogle} error={authError} />;
  }

  return (
    <div className="flex min-h-screen bg-[#FAF8FF] text-[#1F1235]">
      <Sidebar
        activeSection={activeSection}
        onSelectSection={handleSelectSection}
        stats={stats}
        userEmail={user.email ?? ''}
        userName={user.displayName}
        onSignOut={signOutUser}
        onOpenAddModal={() => setIsAddOpen(true)}
        mobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center justify-between gap-4 border-b border-[#E4DCF5] bg-[#FAF8FF]/95 px-4 py-4 backdrop-blur-sm sm:px-8">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open navigation menu"
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[#E4DCF5] bg-white text-[#1F1235] hover:bg-[#F3EFFC] lg:hidden cursor-pointer"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="min-w-0">
              <h1 className="truncate font-display text-xl font-bold tracking-tight text-[#1F1235] sm:text-2xl">
                {sectionHeading[activeSection].title}
              </h1>
              <p className="hidden truncate text-xs text-[#5B4F73] sm:block">
                {sectionHeading[activeSection].subtitle}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsAddOpen(true)}
            className="inline-flex h-10 shrink-0 items-center gap-2 rounded-lg bg-[#3B0764] px-4 text-sm font-semibold text-white hover:bg-[#4C1D95] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4C1D95] whitespace-nowrap cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span>Add Task</span>
          </button>
        </header>

        <main className="mx-auto w-full max-w-7xl flex-1 space-y-6 px-4 py-6 sm:px-8">
          {activeSection === 'dashboard' && (
            <Dashboard stats={stats} loading={loadingTasks} />
          )}

          <SearchAndFilter
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            priorityFilter={priorityFilter}
            onPriorityChange={setPriorityFilter}
            statusFilter={statusFilter}
            onStatusChange={setStatusFilter}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            lockStatusFilter={
              activeSection === 'completed' || activeSection === 'pending'
            }
          />

          <div className="flex items-center justify-between text-xs font-medium text-[#5B4F73]">
            <span className="tabular-nums">
              Showing {filteredTasks.length} of {tasks.length} tasks
            </span>
          </div>

          <TaskList
            tasks={filteredTasks}
            viewMode={viewMode}
            loading={loadingTasks}
            error={fetchError}
            hasActiveFilters={hasActiveFilters}
            onRetry={loadTasks}
            onOpenAddModal={() => setIsAddOpen(true)}
            onClearFilters={clearFilters}
            onEdit={(task) => setEditingTask(task)}
            onDelete={(task) => setDeletingTask(task)}
            onStatusChange={handleQuickStatusChange}
            updatingId={updatingTaskId}
          />
        </main>
      </div>

      <AddTaskForm
        isOpen={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        onSubmit={handleCreateTask}
      />

      <EditTaskForm
        task={editingTask}
        onClose={() => setEditingTask(null)}
        onSubmit={handleUpdateTask}
      />

      <ConfirmationModal
        task={deletingTask}
        deleting={isDeleting}
        onCancel={() => {
          if (!isDeleting) setDeletingTask(null);
        }}
        onConfirm={handleConfirmDelete}
      />

      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <TaskWorkspace />
    </AuthProvider>
  );
}
