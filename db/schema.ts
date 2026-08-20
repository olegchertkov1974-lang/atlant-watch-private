import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const sentAlerts = sqliteTable("sent_alerts", {
  alertId: text("alert_id").primaryKey(),
  source: text("source").notNull(),
  title: text("title").notNull(),
  sentAt: integer("sent_at").notNull(),
});

export const watchState = sqliteTable("watch_state", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: integer("updated_at").notNull(),
});
