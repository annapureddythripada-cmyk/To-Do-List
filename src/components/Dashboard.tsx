import { CheckCircle2, Clock, Layers, Loader2 } from 'lucide-react';
import type { TaskStats } from '../types/task';

interface DashboardProps {
  stats: TaskStats;
  loading: boolean;
}

export function Dashboard({ stats, loading }: DashboardProps) {
  const completionRate =
    stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0;

  const cards = [
    {
      label: 'Total Tasks',
      value: stats.total,
      detail: 'All workspace items',
      icon: Layers,
      iconColor: 'text-[#4C1D95]',
      iconBg: 'bg-[#F3EFFC]',
    },
    {
      label: 'Pending',
      value: stats.pending,
      detail: 'Waiting to start',
      icon: Clock,
      iconColor: 'text-[#B45309]',
      iconBg: 'bg-[#FEF3C7]',
    },
    {
      label: 'In Progress',
      value: stats.inProgress,
      detail: 'Currently active',
      icon: Loader2,
      iconColor: 'text-[#6D28D9]',
      iconBg: 'bg-[#EDE9FE]',
    },
    {
      label: 'Completed',
      value: stats.completed,
      detail: `${completionRate}% completion rate`,
      icon: CheckCircle2,
      iconColor: 'text-[#15803D]',
      iconBg: 'bg-[#DCFCE7]',
    },
  ];

  return (
    <section aria-label="Task summary" className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <div
            key={card.label}
            className="rounded-xl border border-[#E4DCF5] bg-white p-5 transition-colors duration-150 hover:border-[#C4B5FD]"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-[#5B4F73]">{card.label}</p>
                {loading ? (
                  <div className="mt-2 h-8 w-16 animate-pulse rounded bg-[#F3EFFC]" />
                ) : (
                  <p className="mt-1.5 font-display text-3xl font-bold tracking-tight text-[#1F1235] tabular-nums">
                    {card.value}
                  </p>
                )}
              </div>
              <div
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${card.iconBg} ${card.iconColor}`}
              >
                <Icon className="h-5 w-5" />
              </div>
            </div>
            <p className="mt-3 text-xs text-[#6D5F8A] tabular-nums">{card.detail}</p>
          </div>
        );
      })}
    </section>
  );
}
