import {
  CheckCircle2,
  Clock,
  LayoutDashboard,
  ListTodo,
  LogOut,
  Plus,
  X,
} from 'lucide-react';
import type { NavSection, TaskStats } from '../types/task';

interface SidebarProps {
  activeSection: NavSection;
  onSelectSection: (section: NavSection) => void;
  stats: TaskStats;
  userEmail: string;
  userName: string | null;
  onSignOut: () => void;
  onOpenAddModal: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

export function Sidebar({
  activeSection,
  onSelectSection,
  stats,
  userEmail,
  userName,
  onSignOut,
  onOpenAddModal,
  mobileOpen,
  onCloseMobile,
}: SidebarProps) {
  const navItems: Array<{
    id: NavSection;
    label: string;
    count: number;
    icon: typeof LayoutDashboard;
  }> = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      count: stats.total,
      icon: LayoutDashboard,
    },
    {
      id: 'all',
      label: 'All Tasks',
      count: stats.total,
      icon: ListTodo,
    },
    {
      id: 'pending',
      label: 'Pending',
      count: stats.pending + stats.inProgress,
      icon: Clock,
    },
    {
      id: 'completed',
      label: 'Completed',
      count: stats.completed,
      icon: CheckCircle2,
    },
  ];

  const handleNavClick = (section: NavSection) => {
    onSelectSection(section);
    onCloseMobile();
  };

  const sidebarContent = (
    <div className="flex h-full flex-col justify-between bg-[#F3EFFC] border-r border-[#E4DCF5] px-4 py-6">
      <div>
        <div className="flex items-center justify-between px-2 pb-6">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#3B0764] text-white font-display font-bold text-base">
              L
            </div>
            <span className="font-display text-lg font-bold tracking-tight text-[#1F1235] whitespace-nowrap">
              LavenderTask
            </span>
          </div>
          <button
            type="button"
            onClick={onCloseMobile}
            className="lg:hidden inline-flex h-10 w-10 items-center justify-center rounded-lg text-[#5B4F73] hover:bg-[#E7DDFB] hover:text-[#1F1235] transition-colors focus-visible:outline-2 focus-visible:outline-[#4C1D95]"
            aria-label="Close navigation menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <button
          type="button"
          onClick={() => {
            onCloseMobile();
            onOpenAddModal();
          }}
          className="mb-6 flex w-full items-center justify-center gap-2 rounded-lg bg-[#3B0764] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#4C1D95] active:scale-[0.99] transition-all duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4C1D95] whitespace-nowrap cursor-pointer"
        >
          <Plus className="h-4 w-4 shrink-0" />
          <span>New Task</span>
        </button>

        <nav aria-label="Primary navigation" className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeSection === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNavClick(item.id)}
                className={`flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-[#4C1D95] cursor-pointer ${
                  isActive
                    ? 'bg-white text-[#3B0764] shadow-xs border border-[#E4DCF5]'
                    : 'text-[#5B4F73] hover:bg-[#EAE2FA] hover:text-[#1F1235] border border-transparent'
                }`}
              >
                <span className="flex items-center gap-3 whitespace-nowrap">
                  <Icon
                    className={`h-4 w-4 shrink-0 ${
                      isActive ? 'text-[#4C1D95]' : 'text-[#6D5F8A]'
                    }`}
                  />
                  <span>{item.label}</span>
                </span>
                <span
                  className={`font-mono-tabular text-xs ${
                    isActive ? 'text-[#3B0764] font-semibold' : 'text-[#6D5F8A]'
                  }`}
                >
                  {item.count}
                </span>
              </button>
            );
          })}
        </nav>
      </div>

      <div className="border-t border-[#E4DCF5] pt-4">
        <div className="mb-3 px-2">
          <p className="truncate text-sm font-semibold text-[#1F1235]">
            {userName || 'Workspace Member'}
          </p>
          <p className="truncate text-xs text-[#5B4F73]">{userEmail}</p>
        </div>
        <button
          type="button"
          onClick={onSignOut}
          className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-[#5B4F73] hover:bg-[#EAE2FA] hover:text-[#1F1235] transition-colors focus-visible:outline-2 focus-visible:outline-[#4C1D95] cursor-pointer"
        >
          <LogOut className="h-4 w-4 shrink-0" />
          <span>Sign out</span>
        </button>
      </div>
    </div>
  );

  return (
    <>
      <aside className="hidden lg:block lg:w-64 lg:shrink-0 lg:sticky lg:top-0 lg:h-screen">
        {sidebarContent}
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-[#1F1235]/35 backdrop-blur-[1px]"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          <div className="relative z-10 w-72 max-w-[85vw] h-full">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
}
