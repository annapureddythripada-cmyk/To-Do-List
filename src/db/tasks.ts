import { and, desc, eq } from 'drizzle-orm';
import { db } from './index.ts';
import { tasks } from './schema.ts';
import type { TaskRecord } from './schema.ts';
import type {
  CreateTaskPayload,
  TaskPriority,
  TaskStats,
  TaskStatus,
  UpdateTaskPayload,
} from '../types/task.ts';

export interface ListTasksResult {
  tasks: TaskRecord[];
  stats: TaskStats;
}

export async function listTasksByUser(userId: number): Promise<ListTasksResult> {
  try {
    const rows = await db
      .select()
      .from(tasks)
      .where(eq(tasks.userId, userId))
      .orderBy(desc(tasks.createdAt));

    const stats: TaskStats = {
      total: rows.length,
      pending: rows.filter((t) => t.status === 'Pending').length,
      inProgress: rows.filter((t) => t.status === 'In Progress').length,
      completed: rows.filter((t) => t.status === 'Completed').length,
    };

    return { tasks: rows, stats };
  } catch (error) {
    console.error('Database query failed while listing tasks:', error);
    throw new Error('Unable to load tasks right now. Please try again.', {
      cause: error,
    });
  }
}

export async function createTaskForUser(
  userId: number,
  input: CreateTaskPayload
): Promise<TaskRecord> {
  try {
    const result = await db
      .insert(tasks)
      .values({
        userId,
        title: input.title,
        description: input.description ?? null,
        dueDate: input.dueDate ?? null,
        priority: input.priority,
        status: input.status,
        locationName: input.locationName ?? null,
        locationAddress: input.locationAddress ?? null,
        latitude: input.latitude ?? null,
        longitude: input.longitude ?? null,
        placeId: input.placeId ?? null,
      })
      .returning();

    return result[0];
  } catch (error) {
    console.error('Database query failed while creating task:', error);
    throw new Error('Unable to save the new task. Please try again.', {
      cause: error,
    });
  }
}

export async function updateTaskForUser(
  userId: number,
  taskId: string,
  input: UpdateTaskPayload
): Promise<TaskRecord | null> {
  try {
    const updateValues: Partial<{
      title: string;
      description: string | null;
      dueDate: string | null;
      priority: TaskPriority;
      status: TaskStatus;
      locationName: string | null;
      locationAddress: string | null;
      latitude: number | null;
      longitude: number | null;
      placeId: string | null;
    }> = {};

    if (input.title !== undefined) updateValues.title = input.title;
    if (input.description !== undefined) updateValues.description = input.description;
    if (input.dueDate !== undefined) updateValues.dueDate = input.dueDate;
    if (input.priority !== undefined) updateValues.priority = input.priority;
    if (input.status !== undefined) updateValues.status = input.status;
    if (input.locationName !== undefined) updateValues.locationName = input.locationName;
    if (input.locationAddress !== undefined) updateValues.locationAddress = input.locationAddress;
    if (input.latitude !== undefined) updateValues.latitude = input.latitude;
    if (input.longitude !== undefined) updateValues.longitude = input.longitude;
    if (input.placeId !== undefined) updateValues.placeId = input.placeId;

    const result = await db
      .update(tasks)
      .set(updateValues)
      .where(and(eq(tasks.id, taskId), eq(tasks.userId, userId)))
      .returning();

    return result[0] ?? null;
  } catch (error) {
    console.error('Database query failed while updating task:', error);
    throw new Error('Unable to update the task. Please try again.', {
      cause: error,
    });
  }
}

export async function deleteTaskForUser(
  userId: number,
  taskId: string
): Promise<boolean> {
  try {
    const result = await db
      .delete(tasks)
      .where(and(eq(tasks.id, taskId), eq(tasks.userId, userId)))
      .returning({ id: tasks.id });

    return result.length > 0;
  } catch (error) {
    console.error('Database query failed while deleting task:', error);
    throw new Error('Unable to delete the task. Please try again.', {
      cause: error,
    });
  }
}
