export const TASK_PRIORITIES = ['Low', 'Medium', 'High'] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

export const TASK_STATUSES = ['Pending', 'In Progress', 'Completed'] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export interface TaskLocation {
  locationName: string | null;
  locationAddress: string | null;
  latitude: number | null;
  longitude: number | null;
  placeId: string | null;
}

export interface Task extends TaskLocation {
  id: string;
  userId: number;
  title: string;
  description: string | null;
  dueDate: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  createdAt: string;
}

export interface TaskStats {
  total: number;
  pending: number;
  inProgress: number;
  completed: number;
}

export interface CreateTaskPayload {
  title: string;
  description?: string;
  dueDate?: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  locationName?: string | null;
  locationAddress?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  placeId?: string | null;
}

export interface UpdateTaskPayload {
  title?: string;
  description?: string | null;
  dueDate?: string | null;
  priority?: TaskPriority;
  status?: TaskStatus;
  locationName?: string | null;
  locationAddress?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  placeId?: string | null;
}

export interface GameScore {
  id: number;
  score: number;
  wave: number;
  coresCollected: number;
  createdAt: string;
}

export const SOUND_MOODS = [
  'Lavender Drift',
  'Midnight Library',
  'Crystal Rain',
  'Warm Rhodes',
] as const;
export type SoundMood = (typeof SOUND_MOODS)[number];

export interface SoundPreset {
  id: number;
  name: string;
  mood: SoundMood;
  bpm: number;
  warmth: number;
  padLevel: number;
  chimeLevel: number;
  createdAt: string;
}

export type NavSection =
  | 'dashboard'
  | 'all'
  | 'pending'
  | 'completed'
  | 'map'
  | 'scene3d'
  | 'game3d'
  | 'music';

export type ViewMode = 'cards' | 'table';

export interface ToastMessage {
  id: string;
  type: 'success' | 'error';
  message: string;
}
