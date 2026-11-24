import { db } from './index.ts';
import { users } from './schema.ts';
import type { UserRecord } from './schema.ts';

export async function getOrCreateUser(
  uid: string,
  email: string,
  displayName?: string | null
): Promise<UserRecord> {
  try {
    const result = await db
      .insert(users)
      .values({
        uid,
        email,
        displayName: displayName ?? null,
      })
      .onConflictDoUpdate({
        target: users.uid,
        set: {
          email,
          displayName: displayName ?? null,
        },
      })
      .returning();

    return result[0];
  } catch (error) {
    console.error('Database error while syncing user:', error);
    throw new Error('Failed to verify user account. Please try again later.', {
      cause: error,
    });
  }
}
