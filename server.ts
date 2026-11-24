import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { requireAuth } from './src/middleware/auth.ts';
import type { AuthRequest } from './src/middleware/auth.ts';
import {
  createTaskForUser,
  deleteTaskForUser,
  listTasksByUser,
  updateTaskForUser,
} from './src/db/tasks.ts';
import {
  createSoundPresetForUser,
  deleteSoundPresetForUser,
  listGameScoresByUser,
  listSoundPresetsByUser,
  saveGameScoreForUser,
} from './src/db/extras.ts';
import { SOUND_MOODS, TASK_PRIORITIES, TASK_STATUSES } from './src/types/task.ts';
import type { SoundMood, TaskPriority, TaskStatus } from './src/types/task.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function isValidPriority(value: unknown): value is TaskPriority {
  return (
    typeof value === 'string' &&
    (TASK_PRIORITIES as readonly string[]).includes(value)
  );
}

function isValidStatus(value: unknown): value is TaskStatus {
  return (
    typeof value === 'string' &&
    (TASK_STATUSES as readonly string[]).includes(value)
  );
}

function isValidMood(value: unknown): value is SoundMood {
  return (
    typeof value === 'string' &&
    (SOUND_MOODS as readonly string[]).includes(value)
  );
}

function parseDueDate(value: unknown): { valid: boolean; value: string | null } {
  if (value === undefined || value === null || value === '') {
    return { valid: true, value: null };
  }
  if (typeof value !== 'string' || !DATE_REGEX.test(value)) {
    return { valid: false, value: null };
  }
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    return { valid: false, value: null };
  }
  return { valid: true, value };
}

function parseLocationFields(body: Record<string, unknown>): {
  valid: boolean;
  error?: string;
  fields: {
    locationName?: string | null;
    locationAddress?: string | null;
    latitude?: number | null;
    longitude?: number | null;
    placeId?: string | null;
  };
} {
  const fields: {
    locationName?: string | null;
    locationAddress?: string | null;
    latitude?: number | null;
    longitude?: number | null;
    placeId?: string | null;
  } = {};

  if ('locationName' in body) {
    if (body.locationName === null || body.locationName === '') {
      fields.locationName = null;
    } else if (typeof body.locationName === 'string') {
      const trimmed = body.locationName.trim();
      if (trimmed.length > 200) {
        return { valid: false, error: 'Location name too long.', fields };
      }
      fields.locationName = trimmed || null;
    } else {
      return { valid: false, error: 'Invalid location name.', fields };
    }
  }

  if ('locationAddress' in body) {
    if (body.locationAddress === null || body.locationAddress === '') {
      fields.locationAddress = null;
    } else if (typeof body.locationAddress === 'string') {
      const trimmed = body.locationAddress.trim();
      if (trimmed.length > 400) {
        return { valid: false, error: 'Location address too long.', fields };
      }
      fields.locationAddress = trimmed || null;
    } else {
      return { valid: false, error: 'Invalid location address.', fields };
    }
  }

  if ('placeId' in body) {
    if (body.placeId === null || body.placeId === '') {
      fields.placeId = null;
    } else if (typeof body.placeId === 'string') {
      const trimmed = body.placeId.trim();
      if (trimmed.length > 255) {
        return { valid: false, error: 'Place ID too long.', fields };
      }
      fields.placeId = trimmed || null;
    } else {
      return { valid: false, error: 'Invalid Place ID.', fields };
    }
  }

  if ('latitude' in body) {
    if (body.latitude === null || body.latitude === '') {
      fields.latitude = null;
    } else if (
      typeof body.latitude === 'number' &&
      Number.isFinite(body.latitude) &&
      body.latitude >= -90 &&
      body.latitude <= 90
    ) {
      fields.latitude = body.latitude;
    } else {
      return { valid: false, error: 'Latitude must be between -90 and 90.', fields };
    }
  }

  if ('longitude' in body) {
    if (body.longitude === null || body.longitude === '') {
      fields.longitude = null;
    } else if (
      typeof body.longitude === 'number' &&
      Number.isFinite(body.longitude) &&
      body.longitude >= -180 &&
      body.longitude <= 180
    ) {
      fields.longitude = body.longitude;
    } else {
      return {
        valid: false,
        error: 'Longitude must be between -180 and 180.',
        fields,
      };
    }
  }

  return { valid: true, fields };
}

function serializeTask(row: {
  id: string;
  userId: number;
  title: string;
  description: string | null;
  dueDate: string | null;
  priority: string;
  status: string;
  locationName: string | null;
  locationAddress: string | null;
  latitude: number | null;
  longitude: number | null;
  placeId: string | null;
  createdAt: Date;
}) {
  return {
    id: row.id,
    userId: row.userId,
    title: row.title,
    description: row.description,
    dueDate: row.dueDate,
    priority: row.priority as TaskPriority,
    status: row.status as TaskStatus,
    locationName: row.locationName,
    locationAddress: row.locationAddress,
    latitude: row.latitude,
    longitude: row.longitude,
    placeId: row.placeId,
    createdAt:
      row.createdAt instanceof Date
        ? row.createdAt.toISOString()
        : String(row.createdAt),
  };
}

async function startServer() {
  const app = express();
  const port = Number(process.env.PORT) || 3000;

  app.use(express.json({ limit: '64kb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  app.get('/api/tasks', requireAuth, async (req: AuthRequest, res) => {
    try {
      const dbUser = req.dbUser;
      if (!dbUser) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const result = await listTasksByUser(dbUser.id);
      const search =
        typeof req.query.search === 'string'
          ? req.query.search.trim().toLowerCase()
          : '';
      const priorityFilter =
        typeof req.query.priority === 'string' ? req.query.priority : 'All';
      const statusFilter =
        typeof req.query.status === 'string' ? req.query.status : 'All';

      const filtered = result.tasks.filter((task) => {
        if (priorityFilter !== 'All' && task.priority !== priorityFilter) {
          return false;
        }
        if (statusFilter !== 'All' && task.status !== statusFilter) {
          return false;
        }
        if (search) {
          const haystack = `${task.title} ${task.description ?? ''} ${
            task.locationName ?? ''
          }`.toLowerCase();
          if (!haystack.includes(search)) {
            return false;
          }
        }
        return true;
      });

      res.json({
        tasks: filtered.map(serializeTask),
        stats: result.stats,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to load tasks.';
      res.status(500).json({ error: message });
    }
  });

  app.post('/api/tasks', requireAuth, async (req: AuthRequest, res) => {
    try {
      const dbUser = req.dbUser;
      if (!dbUser) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const body = (req.body ?? {}) as Record<string, unknown>;
      const title = typeof body.title === 'string' ? body.title.trim() : '';
      if (!title) {
        res.status(400).json({ error: 'Task title is required.' });
        return;
      }
      if (title.length > 200) {
        res.status(400).json({ error: 'Task title must be 200 characters or fewer.' });
        return;
      }

      const description =
        typeof body.description === 'string' ? body.description.trim() : '';
      if (description.length > 2000) {
        res
          .status(400)
          .json({ error: 'Description must be 2000 characters or fewer.' });
        return;
      }

      const dueDateCheck = parseDueDate(body.dueDate);
      if (!dueDateCheck.valid) {
        res.status(400).json({ error: 'Due date must be a valid YYYY-MM-DD date.' });
        return;
      }

      const priority = body.priority ?? 'Medium';
      if (!isValidPriority(priority)) {
        res.status(400).json({ error: 'Priority must be Low, Medium, or High.' });
        return;
      }

      const status = body.status ?? 'Pending';
      if (!isValidStatus(status)) {
        res
          .status(400)
          .json({ error: 'Status must be Pending, In Progress, or Completed.' });
        return;
      }

      const locationCheck = parseLocationFields(body);
      if (!locationCheck.valid) {
        res.status(400).json({ error: locationCheck.error ?? 'Invalid location data.' });
        return;
      }

      const created = await createTaskForUser(dbUser.id, {
        title,
        description: description || undefined,
        dueDate: dueDateCheck.value,
        priority,
        status,
        ...locationCheck.fields,
      });

      res.status(201).json({ task: serializeTask(created) });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to create task.';
      res.status(500).json({ error: message });
    }
  });

  const handleUpdateTask = async (req: AuthRequest, res: express.Response) => {
    try {
      const dbUser = req.dbUser;
      if (!dbUser) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const taskId = typeof req.params.id === 'string' ? req.params.id : '';
      if (!UUID_REGEX.test(taskId)) {
        res.status(400).json({ error: 'Invalid task identifier.' });
        return;
      }

      const body = (req.body ?? {}) as Record<string, unknown>;
      const updates: {
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
      } = {};

      if ('title' in body) {
        const title = typeof body.title === 'string' ? body.title.trim() : '';
        if (!title) {
          res.status(400).json({ error: 'Task title cannot be empty.' });
          return;
        }
        if (title.length > 200) {
          res
            .status(400)
            .json({ error: 'Task title must be 200 characters or fewer.' });
          return;
        }
        updates.title = title;
      }

      if ('description' in body) {
        if (body.description === null || body.description === '') {
          updates.description = null;
        } else if (typeof body.description === 'string') {
          const trimmed = body.description.trim();
          if (trimmed.length > 2000) {
            res
              .status(400)
              .json({ error: 'Description must be 2000 characters or fewer.' });
            return;
          }
          updates.description = trimmed || null;
        } else {
          res.status(400).json({ error: 'Description must be text.' });
          return;
        }
      }

      if ('dueDate' in body) {
        const dueDateCheck = parseDueDate(body.dueDate);
        if (!dueDateCheck.valid) {
          res
            .status(400)
            .json({ error: 'Due date must be a valid YYYY-MM-DD date.' });
          return;
        }
        updates.dueDate = dueDateCheck.value;
      }

      if ('priority' in body) {
        if (!isValidPriority(body.priority)) {
          res.status(400).json({ error: 'Priority must be Low, Medium, or High.' });
          return;
        }
        updates.priority = body.priority;
      }

      if ('status' in body) {
        if (!isValidStatus(body.status)) {
          res
            .status(400)
            .json({ error: 'Status must be Pending, In Progress, or Completed.' });
          return;
        }
        updates.status = body.status;
      }

      const locationCheck = parseLocationFields(body);
      if (!locationCheck.valid) {
        res.status(400).json({ error: locationCheck.error ?? 'Invalid location data.' });
        return;
      }
      Object.assign(updates, locationCheck.fields);

      if (Object.keys(updates).length === 0) {
        res.status(400).json({ error: 'No valid fields provided for update.' });
        return;
      }

      const updated = await updateTaskForUser(dbUser.id, taskId, updates);
      if (!updated) {
        res.status(404).json({ error: 'Task not found.' });
        return;
      }

      res.json({ task: serializeTask(updated) });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to update task.';
      res.status(500).json({ error: message });
    }
  };

  app.put('/api/tasks/:id', requireAuth, handleUpdateTask);
  app.patch('/api/tasks/:id', requireAuth, handleUpdateTask);

  app.delete('/api/tasks/:id', requireAuth, async (req: AuthRequest, res) => {
    try {
      const dbUser = req.dbUser;
      if (!dbUser) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const taskId = typeof req.params.id === 'string' ? req.params.id : '';
      if (!UUID_REGEX.test(taskId)) {
        res.status(400).json({ error: 'Invalid task identifier.' });
        return;
      }

      const deleted = await deleteTaskForUser(dbUser.id, taskId);
      if (!deleted) {
        res.status(404).json({ error: 'Task not found.' });
        return;
      }

      res.json({ deleted: true, id: taskId });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to delete task.';
      res.status(500).json({ error: message });
    }
  });

  app.get('/api/game/scores', requireAuth, async (req: AuthRequest, res) => {
    try {
      const dbUser = req.dbUser;
      if (!dbUser) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }
      const rows = await listGameScoresByUser(dbUser.id);
      res.json({
        scores: rows.map((r) => ({
          id: r.id,
          score: r.score,
          wave: r.wave,
          coresCollected: r.coresCollected,
          createdAt: r.createdAt.toISOString(),
        })),
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to load scores.';
      res.status(500).json({ error: message });
    }
  });

  app.post('/api/game/scores', requireAuth, async (req: AuthRequest, res) => {
    try {
      const dbUser = req.dbUser;
      if (!dbUser) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }
      const body = (req.body ?? {}) as Record<string, unknown>;
      const score = Number(body.score);
      const wave = Number(body.wave);
      const coresCollected = Number(body.coresCollected);

      if (
        !Number.isInteger(score) ||
        score < 0 ||
        score > 10000000 ||
        !Number.isInteger(wave) ||
        wave < 1 ||
        wave > 1000 ||
        !Number.isInteger(coresCollected) ||
        coresCollected < 0 ||
        coresCollected > 100000
      ) {
        res.status(400).json({ error: 'Invalid score payload.' });
        return;
      }

      const saved = await saveGameScoreForUser(
        dbUser.id,
        score,
        wave,
        coresCollected
      );
      res.status(201).json({
        score: {
          id: saved.id,
          score: saved.score,
          wave: saved.wave,
          coresCollected: saved.coresCollected,
          createdAt: saved.createdAt.toISOString(),
        },
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to save score.';
      res.status(500).json({ error: message });
    }
  });

  app.get('/api/music/presets', requireAuth, async (req: AuthRequest, res) => {
    try {
      const dbUser = req.dbUser;
      if (!dbUser) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }
      const rows = await listSoundPresetsByUser(dbUser.id);
      res.json({
        presets: rows.map((r) => ({
          id: r.id,
          name: r.name,
          mood: r.mood as SoundMood,
          bpm: r.bpm,
          warmth: r.warmth,
          padLevel: r.padLevel,
          chimeLevel: r.chimeLevel,
          createdAt: r.createdAt.toISOString(),
        })),
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to load presets.';
      res.status(500).json({ error: message });
    }
  });

  app.post('/api/music/presets', requireAuth, async (req: AuthRequest, res) => {
    try {
      const dbUser = req.dbUser;
      if (!dbUser) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }
      const body = (req.body ?? {}) as Record<string, unknown>;
      const name = typeof body.name === 'string' ? body.name.trim() : '';
      if (!name || name.length > 80) {
        res
          .status(400)
          .json({ error: 'Preset name is required (max 80 characters).' });
        return;
      }
      if (!isValidMood(body.mood)) {
        res.status(400).json({ error: 'Invalid sound mood.' });
        return;
      }
      const bpm = Number(body.bpm);
      const warmth = Number(body.warmth);
      const padLevel = Number(body.padLevel);
      const chimeLevel = Number(body.chimeLevel);
      if (
        !Number.isInteger(bpm) ||
        bpm < 50 ||
        bpm > 150 ||
        !Number.isInteger(warmth) ||
        warmth < 0 ||
        warmth > 100 ||
        !Number.isInteger(padLevel) ||
        padLevel < 0 ||
        padLevel > 100 ||
        !Number.isInteger(chimeLevel) ||
        chimeLevel < 0 ||
        chimeLevel > 100
      ) {
        res.status(400).json({ error: 'Invalid synthesizer parameter values.' });
        return;
      }

      const saved = await createSoundPresetForUser(dbUser.id, {
        name,
        mood: body.mood,
        bpm,
        warmth,
        padLevel,
        chimeLevel,
      });

      res.status(201).json({
        preset: {
          id: saved.id,
          name: saved.name,
          mood: saved.mood as SoundMood,
          bpm: saved.bpm,
          warmth: saved.warmth,
          padLevel: saved.padLevel,
          chimeLevel: saved.chimeLevel,
          createdAt: saved.createdAt.toISOString(),
        },
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to save preset.';
      res.status(500).json({ error: message });
    }
  });

  app.delete('/api/music/presets/:id', requireAuth, async (req: AuthRequest, res) => {
    try {
      const dbUser = req.dbUser;
      if (!dbUser) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }
      const presetId = Number(req.params.id);
      if (!Number.isInteger(presetId) || presetId <= 0) {
        res.status(400).json({ error: 'Invalid preset ID.' });
        return;
      }
      const deleted = await deleteSoundPresetForUser(dbUser.id, presetId);
      if (!deleted) {
        res.status(404).json({ error: 'Preset not found.' });
        return;
      }
      res.json({ deleted: true, id: presetId });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to delete preset.';
      res.status(500).json({ error: message });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${port}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
