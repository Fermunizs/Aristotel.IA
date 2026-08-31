// Mapeia as tabelas de db/migrations/0001_init.sql. Migrations são do bot — aqui só lê/escreve.
import {
  pgTable, uuid, text, bigint, timestamp, integer, boolean, jsonb, date, time,
} from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  telegramChatId: bigint("telegram_chat_id", { mode: "number" }),
  telegramUsername: text("telegram_username"),
  name: text("name"),
  timezone: text("timezone").notNull(),
  role: text("role").notNull(),
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
  coachTone: text("coach_tone").notNull(),
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
  userId: uuid("user_id").notNull(),
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

export const streaks = pgTable("streaks", {
  userId: uuid("user_id").notNull(),
  kind: text("kind").notNull(),
  current: integer("current").notNull(),
  best: integer("best").notNull(),
  lastDate: date("last_date"),
});
