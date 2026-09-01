// Mapeia as tabelas de db/migrations/0001_init.sql. Migrations são do bot — aqui só lê/escreve.
import {
  pgTable, uuid, text, bigint, timestamp, integer, boolean, jsonb, date, time, real,
} from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  telegramChatId: bigint("telegram_chat_id", { mode: "number" }),
  telegramUsername: text("telegram_username"),
  name: text("name"),
  timezone: text("timezone").notNull(),
  role: text("role").notNull(),
  plan: text("plan").notNull(),
  status: text("status").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
});

export const authCodes = pgTable("auth_codes", {
  code: text("code").primaryKey(),
  userId: uuid("user_id").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
});

export const webSessions = pgTable("web_sessions", {
  token: text("token").primaryKey(),
  userId: uuid("user_id").notNull(),
  actsAs: uuid("acts_as"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});

export const preferences = pgTable("preferences", {
  userId: uuid("user_id").primaryKey(),
  minutesPerDay: integer("minutes_per_day").notNull(),
  wakeTime: time("wake_time").notNull(),
  sleepTime: time("sleep_time").notNull(),
  quietStart: time("quiet_start"), // janela de silêncio (opcional) — bot não agenda nada dentro dela
  quietEnd: time("quiet_end"),
  coachTone: text("coach_tone").notNull(),
  coachNote: text("coach_note").notNull(),
  enabledFunctions: jsonb("enabled_functions").notNull(),
});

export const learningPlans = pgTable("learning_plans", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull(),
  goal: text("goal").notNull(),
  level: text("level").notNull(),
  weeks: jsonb("weeks").notNull(),
  currentWeek: integer("current_week").notNull(),
  currentDay: integer("current_day").notNull(),
  knownTopics: jsonb("known_topics").notNull(),
  active: boolean("active").notNull(),
});

export const tasks = pgTable("tasks", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull(),
  day: date("day").notNull(),
  source: text("source").notNull(),
  title: text("title").notNull(),
  detail: text("detail"),
  status: text("status").notNull(),
  doneVia: text("done_via"),
  sortOrder: integer("sort_order").notNull(),
  doneAt: timestamp("done_at", { withTimezone: true }),
});

export const events = pgTable("events", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id"), // null = evento de sistema (ex: llm:near_limit:<provider>)
  day: date("day").notNull(),
  kind: text("kind").notNull(),
  payload: jsonb("payload").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
});

export const focusSessions = pgTable("focus_sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull(),
  taskId: uuid("task_id"),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
  endedAt: timestamp("ended_at", { withTimezone: true }),
  minutes: integer("minutes"),
  completed: boolean("completed").notNull(),
});

export const contentIdeas = pgTable("content_ideas", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull(),
  theme: text("theme").notNull(),
  format: text("format"),
  title: text("title"),
  published: boolean("published").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
});

export const reminders = pgTable("reminders", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull(),
  kind: text("kind").notNull(),
  customText: text("custom_text"),
  scheduleType: text("schedule_type").notNull(),
  atTime: time("at_time"),
  period: text("period"),
  days: jsonb("days").notNull(),
  channel: text("channel").notNull(),
  enabled: boolean("enabled").notNull(),
  sortOrder: integer("sort_order").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }),
});

export const botState = pgTable("bot_state", {
  userId: uuid("user_id").primaryKey(),
  remindersDirty: boolean("reminders_dirty").notNull(),
  pending: jsonb("pending"),
  history: jsonb("history"), // memória de conversa compartilhada bot <-> painel
});

// Mensagens que o web quer que o bot mande no Telegram (bot/main.py::_outbox_tick).
export const outbox = pgTable("outbox", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull(),
  text: text("text").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  sentAt: timestamp("sent_at", { withTimezone: true }),
});

export const appSettings = pgTable("app_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }),
});

export const pushSubscriptions = pgTable("push_subscriptions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull(),
  endpoint: text("endpoint").notNull(),
  p256dh: text("p256dh").notNull(),
  auth: text("auth").notNull(),
  label: text("label"),
});

export const streaks = pgTable("streaks", {
  userId: uuid("user_id").notNull(),
  kind: text("kind").notNull(),
  current: integer("current").notNull(),
  best: integer("best").notNull(),
  lastDate: date("last_date"),
});

// telemetria de consumo de LLM — 1 linha por chamada (bot/usage.py + web/coach-llm.ts)
export const llmUsage = pgTable("llm_usage", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id"),
  source: text("source").notNull(),
  tag: text("tag"),
  provider: text("provider").notNull(),
  model: text("model"),
  promptTokens: integer("prompt_tokens").notNull(),
  completionTokens: integer("completion_tokens").notNull(),
  fallback: boolean("fallback").notNull(),
  ok: boolean("ok").notNull(),
  status: text("status"),
  // D1: snapshot dos headers x-ratelimit-* da resposta (nullable — nem todo provedor manda)
  rlRemainingRequests: integer("rl_remaining_requests"),
  rlRemainingTokens: bigint("rl_remaining_tokens", { mode: "number" }),
  rlLimitRequests: integer("rl_limit_requests"),
  rlLimitTokens: bigint("rl_limit_tokens", { mode: "number" }),
  rlResetSeconds: real("rl_reset_seconds"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
});

// D2: saúde da VM Oracle — 1 linha só (id=1), o bot faz upsert a cada 60s (bot/vitals.py)
export const systemVitals = pgTable("system_vitals", {
  id: integer("id").primaryKey(),
  cpuLoad1: real("cpu_load_1"),
  cpuLoad5: real("cpu_load_5"),
  cpuLoad15: real("cpu_load_15"),
  memTotalMb: integer("mem_total_mb"),
  memAvailableMb: integer("mem_available_mb"),
  swapTotalMb: integer("swap_total_mb"),
  swapFreeMb: integer("swap_free_mb"),
  diskTotalGb: real("disk_total_gb"),
  diskFreeGb: real("disk_free_gb"),
  services: jsonb("services").notNull(),
  pgSizeBytes: bigint("pg_size_bytes", { mode: "number" }),
  lastBackupAt: timestamp("last_backup_at", { withTimezone: true }),
  lastBackupBytes: bigint("last_backup_bytes", { mode: "number" }),
  botUptimeSeconds: bigint("bot_uptime_seconds", { mode: "number" }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
});
