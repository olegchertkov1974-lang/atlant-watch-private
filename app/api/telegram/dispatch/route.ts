import { GET as getAlerts } from "../../alerts/route";

const CENTER = { lat: 55.821573, lon: 38.246878 };
const ALLOWED_RADII = new Set([5, 10, 20, 30]);

type AlertItem = {
  id: string;
  title: string;
  location: string;
  lat: number | null;
  lon: number | null;
  scope: "local" | "regional";
  source: string;
  sourceUrl: string;
  sourceType: "official" | "monitoring";
  status: "active" | "watch" | "closed";
  publishedAt: string;
};

type TelegramUpdate = {
  message?: {
    text?: string;
    chat?: { id?: number; type?: string };
  };
};

function distanceKm(aLat: number, aLon: number, bLat: number, bLon: number) {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLon = toRad(bLon - aLon);
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function telegramCall<T>(token: string, method: string, body?: Record<string, unknown>) {
  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: body ? "POST" : "GET",
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const payload = (await response.json()) as { ok?: boolean; result?: T; description?: string };
  if (!response.ok || !payload.ok) throw new Error(payload.description || `Telegram HTTP ${response.status}`);
  return payload.result as T;
}

async function findPrivateChat(token: string) {
  const updates = await telegramCall<TelegramUpdate[]>(token, "getUpdates?limit=30&allowed_updates=%5B%22message%22%5D");
  return [...updates]
    .reverse()
    .find(
      (update) =>
        update.message?.chat?.type === "private" &&
        typeof update.message.chat.id === "number" &&
        update.message.text?.trim().startsWith("/start"),
    )?.message?.chat?.id;
}

async function ensureTables(db: D1Database) {
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS sent_alerts (
      alert_id TEXT PRIMARY KEY NOT NULL,
      source TEXT NOT NULL,
      title TEXT NOT NULL,
      sent_at INTEGER NOT NULL
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS watch_state (
      key TEXT PRIMARY KEY NOT NULL,
      value TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    )`),
  ]);
}

async function getState(db: D1Database, key: string) {
  return db.prepare("SELECT value, updated_at AS updatedAt FROM watch_state WHERE key = ?1").bind(key).first<{ value: string; updatedAt: number }>();
}

async function setState(db: D1Database, key: string, value: string, now: number) {
  await db.prepare(
    `INSERT INTO watch_state (key, value, updated_at) VALUES (?1, ?2, ?3)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
  ).bind(key, value, now).run();
}

function inRadius(alert: AlertItem, radius: number) {
  if (alert.scope === "regional") return true;
  if (alert.lat === null || alert.lon === null) return false;
  return distanceKm(CENTER.lat, CENTER.lon, alert.lat, alert.lon) <= radius;
}

function alertMessage(alert: AlertItem, radius: number) {
  const status = alert.status === "closed" ? "🟢 ОТБОЙ" : alert.status === "watch" ? "🟠 ВНИМАНИЕ" : "🔴 ОПАСНОСТЬ";
  const trust = alert.sourceType === "official" ? "✅ Официальный источник" : "⚠️ Мониторинговый канал — не подтверждено";
  const location = alert.scope === "regional" ? "Московский регион · без точной привязки" : `${alert.location} · в радиусе ${radius} км`;
  return [
    `<b>${status} · АТЛАНТ / WATCH</b>`,
    "",
    `<b>${escapeHtml(alert.title)}</b>`,
    escapeHtml(location),
    escapeHtml(trust),
    `Источник: <a href="${escapeHtml(alert.sourceUrl)}">${escapeHtml(alert.source)}</a>`,
  ].join("\n");
}

export async function POST(request: Request) {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  if (!token) return Response.json({ ready: false, stage: "token_missing", sent: 0 });

  let radius = 10;
  try {
    const payload = (await request.json()) as { radius?: number };
    if (payload.radius && ALLOWED_RADII.has(payload.radius)) radius = payload.radius;
  } catch {
    // Empty request bodies use the safe default radius.
  }

  try {
    const chatId = await findPrivateChat(token);
    if (!chatId) return Response.json({ ready: false, stage: "start_required", sent: 0 });

    const { env } = await import("cloudflare:workers");
    const db = env.DB as D1Database | undefined;
    if (!db) return Response.json({ ready: false, stage: "storage_unavailable", sent: 0 });
    await ensureTables(db);

    const now = Date.now();
    const lastDispatch = await getState(db, "last_dispatch");
    if (lastDispatch && now - lastDispatch.updatedAt < 45_000) {
      return Response.json({ ready: true, stage: "active", sent: 0, throttled: true, radius });
    }
    await setState(db, "last_dispatch", String(now), now);

    const feedResponse = await getAlerts();
    const feed = (await feedResponse.json()) as { alerts?: AlertItem[] };
    const candidates = (feed.alerts ?? []).filter((alert) => inRadius(alert, radius));
    const initialized = await getState(db, "telegram_initialized");

    if (!initialized) {
      await telegramCall(token, "sendMessage", {
        chat_id: chatId,
        text: `✅ <b>Атлант / Watch подключён</b>\n\nРадиус уведомлений: <b>${radius} км</b>.\nТекущие события записаны как исходная точка. Дальше бот будет присылать только новые сообщения.`,
        parse_mode: "HTML",
        disable_web_page_preview: true,
      });
      for (const alert of candidates) {
        await db.prepare(
          "INSERT OR IGNORE INTO sent_alerts (alert_id, source, title, sent_at) VALUES (?1, ?2, ?3, ?4)",
        ).bind(alert.id, alert.source, alert.title, now).run();
      }
      await setState(db, "telegram_initialized", String(radius), now);
      return Response.json({ ready: true, stage: "active", sent: 1, initialized: true, radius });
    }

    const rows = await db.prepare("SELECT alert_id AS alertId FROM sent_alerts ORDER BY sent_at DESC LIMIT 500").all<{ alertId: string }>();
    const seen = new Set((rows.results ?? []).map((row) => row.alertId));
    const fresh = candidates
      .filter((alert) => !seen.has(alert.id))
      .sort((a, b) => Date.parse(a.publishedAt) - Date.parse(b.publishedAt))
      .slice(0, 8);

    let sent = 0;
    for (const alert of fresh) {
      await telegramCall(token, "sendMessage", {
        chat_id: chatId,
        text: alertMessage(alert, radius),
        parse_mode: "HTML",
        disable_web_page_preview: true,
      });
      await db.prepare(
        "INSERT OR IGNORE INTO sent_alerts (alert_id, source, title, sent_at) VALUES (?1, ?2, ?3, ?4)",
      ).bind(alert.id, alert.source, alert.title, Date.now()).run();
      sent += 1;
    }

    return Response.json({ ready: true, stage: "active", sent, radius });
  } catch {
    return Response.json({ ready: false, stage: "unavailable", sent: 0 }, { status: 503 });
  }
}
