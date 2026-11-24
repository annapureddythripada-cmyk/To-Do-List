import { and, desc, eq } from 'drizzle-orm';
import { db } from './index.ts';
import { gameScores, soundPresets } from './schema.ts';
import type { GameScoreRecord, SoundPresetRecord } from './schema.ts';
import type { SoundMood } from '../types/task.ts';

export async function listGameScoresByUser(
  userId: number
): Promise<GameScoreRecord[]> {
  try {
    return await db
      .select()
      .from(gameScores)
      .where(eq(gameScores.userId, userId))
      .orderBy(desc(gameScores.score), desc(gameScores.createdAt))
      .limit(10);
  } catch (error) {
    console.error('Database query failed while listing game scores:', error);
    throw new Error('Unable to load high scores right now.', { cause: error });
  }
}

export async function saveGameScoreForUser(
  userId: number,
  score: number,
  wave: number,
  coresCollected: number
): Promise<GameScoreRecord> {
  try {
    const result = await db
      .insert(gameScores)
      .values({
        userId,
        score,
        wave,
        coresCollected,
      })
      .returning();

    return result[0];
  } catch (error) {
    console.error('Database query failed while saving game score:', error);
    throw new Error('Unable to save your score right now.', { cause: error });
  }
}

export async function listSoundPresetsByUser(
  userId: number
): Promise<SoundPresetRecord[]> {
  try {
    return await db
      .select()
      .from(soundPresets)
      .where(eq(soundPresets.userId, userId))
      .orderBy(desc(soundPresets.createdAt))
      .limit(20);
  } catch (error) {
    console.error('Database query failed while listing sound presets:', error);
    throw new Error('Unable to load sound presets right now.', {
      cause: error,
    });
  }
}

export async function createSoundPresetForUser(
  userId: number,
  input: {
    name: string;
    mood: SoundMood;
    bpm: number;
    warmth: number;
    padLevel: number;
    chimeLevel: number;
  }
): Promise<SoundPresetRecord> {
  try {
    const result = await db
      .insert(soundPresets)
      .values({
        userId,
        name: input.name,
        mood: input.mood,
        bpm: input.bpm,
        warmth: input.warmth,
        padLevel: input.padLevel,
        chimeLevel: input.chimeLevel,
      })
      .returning();

    return result[0];
  } catch (error) {
    console.error('Database query failed while creating sound preset:', error);
    throw new Error('Unable to save sound preset right now.', {
      cause: error,
    });
  }
}

export async function deleteSoundPresetForUser(
  userId: number,
  presetId: number
): Promise<boolean> {
  try {
    const result = await db
      .delete(soundPresets)
      .where(and(eq(soundPresets.id, presetId), eq(soundPresets.userId, userId)))
      .returning({ id: soundPresets.id });

    return result.length > 0;
  } catch (error) {
    console.error('Database query failed while deleting sound preset:', error);
    throw new Error('Unable to delete sound preset right now.', {
      cause: error,
    });
  }
}
