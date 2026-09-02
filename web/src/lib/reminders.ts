import { and, eq, asc, sql } from "drizzle-orm";
import { db } from "./db";
import { botState, reminders } from "./schema";

export { KINDS, CHANNELS, DAY_LABELS, type Kind } from "./reminder-kinds";

// Espelha bot/db.py::_DEFAULT_REMINDERS — o conjunto padrão que o onboarding cria.
const DEFAULT_REMINDERS: { kind: string; atTime: string; sortOrder: number }[] = [
  { kind: "motivacao", atTime: "06:00", sortOrder: 0 },
  { kind: "guia", atTime: "08:00", sortOrder: 1 },
  { kind: "pilula", atTime: "09:00", sortOrder: 2 },
  { kind: "quiz", atTime: "10:30", sortOrder: 3 },
  { kind: "insight", atTime: "15:00", sortOrder: 4 },
  { kind: "desafio", atTime: "16:00", sortOrder: 5 },
  { kind: "checkin_noite", atTime: "20:00", sortOrder: 6 },
];

/**
 * Auto-cura: se um usuário ATIVO ficou sem nenhum lembrete (falha silenciosa no
 * onboarding — ver bot/onboarding.py::_activate, que engole a exceção), recria o
 * conjunto padrão. No-op se já houver qualquer lembrete.
 */
export async function ensureReminders(userId: string): Promise<void> {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(reminders)
    .where(eq(reminders.userId, userId));
  if ((row?.n ?? 0) > 0) return;

  await db.insert(reminders).values(
    DEFAULT_REMINDERS.map((d) => ({
      userId,
      kind: d.kind,
      customText: null,
      scheduleType: "fixo",
      atTime: d.atTime,
      period: null,
      days: [0, 1, 2, 3, 4, 5, 6],
      channel: "telegram",
      enabled: true,
      sortOrder: d.sortOrder,
    })),
  );
  await markDirty(userId);
}

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
