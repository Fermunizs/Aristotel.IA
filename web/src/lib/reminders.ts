import { and, eq, asc, sql } from "drizzle-orm";
import { db } from "./db";
import { botState, reminders } from "./schema";

export { KINDS, CHANNELS, DAY_LABELS, type Kind } from "./reminder-kinds";

export async function getReminders(userId: string) {
  const rows = await db
    .select()
    .from(reminders)
    .where(eq(reminders.userId, userId))
    .orderBy(asc(reminders.sortOrder), asc(reminders.atTime));
  return rows.map((r) => ({ ...r, days: (r.days as number[]) ?? [0, 1, 2, 3, 4, 5, 6] }));
}

export async function markDirty(userId: string) {
  await db.update(botState).set({ remindersDirty: true }).where(eq(botState.userId, userId));
}

export async function reminderCount(userId: string) {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(reminders)
    .where(and(eq(reminders.userId, userId), eq(reminders.enabled, true)));
  return row?.n ?? 0;
}
