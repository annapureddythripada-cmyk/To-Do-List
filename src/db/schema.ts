import { relations } from 'drizzle-orm';
import {
  date,
  doublePrecision,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(),
  email: text('email').notNull(),
  displayName: text('display_name'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const tasks = pgTable('tasks', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  title: text('title').notNull(),
  description: text('description'),
  dueDate: date('due_date'),
  priority: text('priority').notNull().default('Medium'),
  status: text('status').notNull().default('Pending'),
  locationName: text('location_name'),
  locationAddress: text('location_address'),
  latitude: doublePrecision('latitude'),
  longitude: doublePrecision('longitude'),
  placeId: text('place_id'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const gameScores = pgTable('game_scores', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  score: integer('score').notNull(),
  wave: integer('wave').notNull(),
  coresCollected: integer('cores_collected').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const soundPresets = pgTable('sound_presets', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  name: text('name').notNull(),
  mood: text('mood').notNull(),
  bpm: integer('bpm').notNull(),
  warmth: integer('warmth').notNull(),
  padLevel: integer('pad_level').notNull(),
  chimeLevel: integer('chime_level').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const usersRelations = relations(users, ({ many }) => ({
  tasks: many(tasks),
  gameScores: many(gameScores),
  soundPresets: many(soundPresets),
}));

export const tasksRelations = relations(tasks, ({ one }) => ({
  owner: one(users, {
    fields: [tasks.userId],
    references: [users.id],
  }),
}));

export const gameScoresRelations = relations(gameScores, ({ one }) => ({
  player: one(users, {
    fields: [gameScores.userId],
    references: [users.id],
  }),
}));

export const soundPresetsRelations = relations(soundPresets, ({ one }) => ({
  owner: one(users, {
    fields: [soundPresets.userId],
    references: [users.id],
  }),
}));

export type UserRecord = typeof users.$inferSelect;
export type TaskRecord = typeof tasks.$inferSelect;
export type NewTaskRecord = typeof tasks.$inferInsert;
export type GameScoreRecord = typeof gameScores.$inferSelect;
export type SoundPresetRecord = typeof soundPresets.$inferSelect;
