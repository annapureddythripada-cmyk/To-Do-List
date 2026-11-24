import type {
  CreateTaskPayload,
  GameScore,
  SoundMood,
  SoundPreset,
  Task,
  TaskStats,
  UpdateTaskPayload,
} from '../types/task';

async function apiRequest<T>(
  url: string,
  token: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(options.headers ?? {}),
    },
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message =
      typeof payload?.error === 'string'
        ? payload.error
        : `Request failed (${response.status})`;
    throw new Error(message);
  }

  return payload as T;
}

export async function fetchTasks(
  token: string,
  filters?: { search?: string; priority?: string; status?: string }
): Promise<{ tasks: Task[]; stats: TaskStats }> {
  const params = new URLSearchParams();
  if (filters?.search?.trim()) params.set('search', filters.search.trim());
  if (filters?.priority && filters.priority !== 'All') {
    params.set('priority', filters.priority);
  }
  if (filters?.status && filters.status !== 'All') {
    params.set('status', filters.status);
  }
  const query = params.toString();
  return apiRequest<{ tasks: Task[]; stats: TaskStats }>(
    `/api/tasks${query ? `?${query}` : ''}`,
    token
  );
}

export async function createTask(
  token: string,
  data: CreateTaskPayload
): Promise<Task> {
  const res = await apiRequest<{ task: Task }>('/api/tasks', token, {
    method: 'POST',
    body: JSON.stringify(data),
  });
  return res.task;
}

export async function updateTask(
  token: string,
  id: string,
  data: UpdateTaskPayload
): Promise<Task> {
  const res = await apiRequest<{ task: Task }>(`/api/tasks/${id}`, token, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
  return res.task;
}

export async function deleteTask(token: string, id: string): Promise<void> {
  await apiRequest<{ deleted: boolean; id: string }>(
    `/api/tasks/${id}`,
    token,
    {
      method: 'DELETE',
    }
  );
}

export async function fetchGameScores(token: string): Promise<GameScore[]> {
  const res = await apiRequest<{ scores: GameScore[] }>(
    '/api/game/scores',
    token
  );
  return res.scores;
}

export async function saveGameScore(
  token: string,
  payload: { score: number; wave: number; coresCollected: number }
): Promise<GameScore> {
  const res = await apiRequest<{ score: GameScore }>('/api/game/scores', token, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return res.score;
}

export async function fetchSoundPresets(
  token: string
): Promise<SoundPreset[]> {
  const res = await apiRequest<{ presets: SoundPreset[] }>(
    '/api/music/presets',
    token
  );
  return res.presets;
}

export async function createSoundPreset(
  token: string,
  payload: {
    name: string;
    mood: SoundMood;
    bpm: number;
    warmth: number;
    padLevel: number;
    chimeLevel: number;
  }
): Promise<SoundPreset> {
  const res = await apiRequest<{ preset: SoundPreset }>(
    '/api/music/presets',
    token,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    }
  );
  return res.preset;
}

export async function deleteSoundPreset(
  token: string,
  id: number
): Promise<void> {
  await apiRequest<{ deleted: boolean; id: number }>(
    `/api/music/presets/${id}`,
    token,
    {
      method: 'DELETE',
    }
  );
}
