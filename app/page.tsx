"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Circle, LayerGroup, Map as LeafletMap } from "leaflet";

const CENTER = { lat: 55.821573, lon: 38.246878 };
const RADII = [5, 10, 20, 30];

type AlertItem = {
  id: string;
  title: string;
  text: string;
  location: string;
  lat: number | null;
  lon: number | null;
  scope: "local" | "regional";
  source: string;
  sourceId: string;
  sourceUrl: string;
  sourceType: "official" | "monitoring";
  status: "active" | "watch" | "closed";
  publishedAt: string;
};

type SourceStatus = {
  id: string;
  label: string;
  kind: "official" | "monitoring";
  url: string;
  reachable: boolean;
  matched: number;
};

type FeedResponse = {
  checkedAt: string;
  alerts: AlertItem[];
  sources: SourceStatus[];
};

type TelegramStage = "checking" | "token_missing" | "start_required" | "ready" | "active" | "storage_unavailable" | "unavailable";

function distanceKm(aLat: number, aLon: number, bLat: number, bLon: number) {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const earthRadius = 6371;
  const dLat = toRad(bLat - aLat);
  const dLon = toRad(bLon - aLon);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLon / 2) ** 2;
  return earthRadius * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("ru-RU", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Moscow" }).format(new Date(value));
}

function formatCheckedAt(value: string | null) {
  if (!value) return "ожидание данных";
  return `обновлено ${formatTime(value)} мск`;
}

function MapPanel({ radius, alerts }: { radius: number; alerts: AlertItem[] }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const radiusRef = useRef<Circle | null>(null);
  const markersRef = useRef<LayerGroup | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function mountMap() {
      if (!containerRef.current || mapRef.current) return;
      const L = await import("leaflet");
      if (cancelled || !containerRef.current) return;
      const map = L.map(containerRef.current, { zoomControl: false, attributionControl: true }).setView([CENTER.lat, CENTER.lon], 11);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 18, attribution: "© OpenStreetMap" }).addTo(map);
      L.control.zoom({ position: "bottomright" }).addTo(map);
      radiusRef.current = L.circle([CENTER.lat, CENTER.lon], {
        radius: 10 * 1000,
        color: "#f6a53a",
        weight: 2,
        fillColor: "#f6a53a",
        fillOpacity: 0.1,
        dashArray: "8 8",
      }).addTo(map);
      L.circleMarker([CENTER.lat, CENTER.lon], {
        radius: 9,
        color: "#fff7e9",
        weight: 3,
        fillColor: "#ff8a1f",
        fillOpacity: 1,
      })
        .addTo(map)
        .bindTooltip("Атлант‑Парк", { permanent: true, direction: "top", offset: [0, -10], className: "atlant-map-label" });
      markersRef.current = L.layerGroup().addTo(map);
      mapRef.current = map;
      window.setTimeout(() => map.invalidateSize(), 0);
    }
    void mountMap();
    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      radiusRef.current = null;
      markersRef.current = null;
    };
  }, []);

  useEffect(() => {
    radiusRef.current?.setRadius(radius * 1000);
    const bounds = radiusRef.current?.getBounds();
    if (bounds) mapRef.current?.fitBounds(bounds, { padding: [36, 36], animate: true });
  }, [radius]);

  useEffect(() => {
    let cancelled = false;
    async function drawAlerts() {
      const L = await import("leaflet");
      if (cancelled || !markersRef.current) return;
      markersRef.current.clearLayers();
      alerts.forEach((alert) => {
        if (alert.lat === null || alert.lon === null) return;
        const color = alert.status === "closed" ? "#7b8794" : alert.sourceType === "official" ? "#ff5c5c" : "#f6a53a";
        const popup = document.createElement("div");
        const strong = document.createElement("strong");
        const small = document.createElement("small");
        strong.textContent = alert.location;
        small.textContent = `${alert.title} · ${alert.source}`;
        popup.append(strong, document.createElement("br"), small);
        L.circleMarker([alert.lat, alert.lon], {
          radius: 7,
          color: "#111820",
          weight: 2,
          fillColor: color,
          fillOpacity: 0.95,
        })
          .bindPopup(popup)
          .addTo(markersRef.current!);
      });
    }
    void drawAlerts();
    return () => {
      cancelled = true;
    };
  }, [alerts]);

  return <div ref={containerRef} className="map-canvas" aria-label="Карта зоны Атлант-Парка" />;
}

export default function Home() {
  const [radius, setRadius] = useState(10);
  const [onlyInside, setOnlyInside] = useState(true);
  const [feed, setFeed] = useState<FeedResponse>({ checkedAt: "", alerts: [], sources: [] });
  const [loading, setLoading] = useState(true);
  const [feedError, setFeedError] = useState(false);
  const [telegramStage, setTelegramStage] = useState<TelegramStage>("checking");

  const refreshFeed = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/alerts", { cache: "no-store" });
      if (!response.ok) throw new Error("feed unavailable");
      setFeed((await response.json()) as FeedResponse);
      setFeedError(false);
    } catch {
      setFeedError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  const checkTelegram = useCallback(async () => {
    setTelegramStage("checking");
    try {
      const response = await fetch("/api/telegram/dispatch", {
        method: "POST",
        cache: "no-store",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ radius }),
      });
      const data = (await response.json()) as { stage?: TelegramStage };
      setTelegramStage(data.stage ?? "unavailable");
    } catch {
      setTelegramStage("unavailable");
    }
  }, [radius]);

  useEffect(() => {
    const initial = window.setTimeout(() => {
      void refreshFeed();
      void checkTelegram();
    }, 0);
    const timer = window.setInterval(() => {
      void refreshFeed();
      void checkTelegram();
    }, 60_000);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(timer);
    };
  }, [checkTelegram, refreshFeed]);

  const alerts = useMemo(
    () => feed.alerts
      .map((item) => ({
        ...item,
        distance: item.lat !== null && item.lon !== null ? distanceKm(CENTER.lat, CENTER.lon, item.lat, item.lon) : null,
      }))
      .filter((item) => !onlyInside || item.scope === "regional" || (item.distance !== null && item.distance <= radius)),
    [feed.alerts, onlyInside, radius],
  );

  const reachableSources = feed.sources.filter((source) => source.reachable).length;
  const officialSources = feed.sources.filter((source) => source.kind === "official" && source.reachable).length;
  const monitoringSources = feed.sources.filter((source) => source.kind === "monitoring" && source.reachable).length;
  const officialSourcesTotal = feed.sources.filter((source) => source.kind === "official").length;
  const monitoringSourcesTotal = feed.sources.filter((source) => source.kind === "monitoring").length;
  const telegramCopy = {
    checking: ["ПРОВЕРКА", "Проверяем защищённое подключение…"],
    token_missing: ["НУЖНА НАСТРОЙКА", "Добавьте токен бота как секрет TELEGRAM_BOT_TOKEN в настройках сайта."],
    start_required: ["ЖДЁМ /START", "Откройте созданного бота в Telegram и нажмите «Запустить», затем повторите проверку."],
    ready: ["ЛИЧНЫЙ ЧАТ НАЙДЕН", "Бот увидел ваш личный чат. Следующий этап — включить фоновую отправку новых событий."],
    active: ["ОТПРАВКА ВКЛЮЧЕНА", `Новые события в радиусе ${radius} км отправляются без повторов, пока карта открыта.`],
    storage_unavailable: ["НУЖНО ХРАНИЛИЩЕ", "История отправок пока недоступна. Обновите страницу после публикации новой версии."],
    unavailable: ["НЕТ СВЯЗИ", "Telegram временно не ответил. Повторите проверку через минуту."],
  } satisfies Record<TelegramStage, [string, string]>;

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand-block">
          <div className="brand-mark" aria-hidden="true"><span /><span /><span /></div>
          <div><p className="eyebrow">ЛОКАЛЬНЫЙ МОНИТОРИНГ</p><h1>АТЛАНТ / WATCH</h1></div>
        </div>
        <div className="topbar-actions">
          <div className={`setup-badge ${reachableSources ? "live" : ""}`}><i /> {reachableSources ? "ИСТОЧНИКИ LIVE" : "ПРОВЕРКА СВЯЗИ"}</div>
          <p className="clock">МОСКВА · UTC+3</p>
        </div>
      </header>

      <div className={`demo-notice ${feedError ? "error" : ""}`}>
        <span>{feedError ? "СБОЙ" : "ПУБЛИЧНЫЕ ДАННЫЕ"}</span>
        {feedError ? "Не удалось обновить ленту. Последние полученные данные сохранены на экране." : "Официальные сообщения отделены от мониторинговых каналов. Точные координаты целей не показываются."}
        <b>{formatCheckedAt(feed.checkedAt || null)}</b>
      </div>

      <section className="workspace">
        <div className="map-card">
          <MapPanel radius={radius} alerts={alerts} />
          <div className="map-heading"><p>ЦЕНТР ЗОНЫ</p><strong>Атлант‑Парк, Обухово</strong><span>55.821573 · 38.246878</span></div>
          <div className="radius-control" aria-label="Выбор радиуса мониторинга">
            <p>РАДИУС</p>
            <div>{RADII.map((value) => (
              <button key={value} className={radius === value ? "active" : ""} onClick={() => setRadius(value)} type="button" aria-pressed={radius === value}>{value} км</button>
            ))}</div>
          </div>
          <div className="map-legend">
            <span><i className="dot red" /> Официальное</span>
            <span><i className="dot amber" /> Требует проверки</span>
            <span><i className="dot gray" /> Завершено</span>
          </div>
        </div>

        <aside className="side-panel">
          <section className="panel-section alert-section">
            <div className="section-heading">
              <div><p className="eyebrow">ЛЕНТА</p><h2>События в зоне</h2></div>
              <div className="heading-actions">
                <button className="refresh-button" type="button" onClick={refreshFeed} disabled={loading} aria-label="Обновить ленту">{loading ? "···" : "↻"}</button>
                <span className="count-badge">{alerts.length}</span>
              </div>
            </div>

            <div className="segmented-control">
              <button className={onlyInside ? "active" : ""} onClick={() => setOnlyInside(true)} type="button">В радиусе</button>
              <button className={!onlyInside ? "active" : ""} onClick={() => setOnlyInside(false)} type="button">Весь регион</button>
            </div>

            <div className="alert-list">
              {alerts.map((alert) => (
                <article className={`alert-item ${alert.status}`} key={alert.id}>
                  <div className="alert-timeline"><span>{formatTime(alert.publishedAt)}</span><i /></div>
                  <div className="alert-content">
                    <div className="alert-meta">
                      <span className={alert.sourceType}>{alert.sourceType === "official" ? "ОФИЦИАЛЬНО" : "МОНИТОРИНГ"}</span>
                      <b>{alert.scope === "regional" ? "по региону" : `${alert.distance?.toFixed(1)} км`}</b>
                    </div>
                    <h3>{alert.title}</h3>
                    <p>{alert.location} · <a href={alert.sourceUrl} target="_blank" rel="noreferrer">{alert.source}</a></p>
                  </div>
                </article>
              ))}
              {!loading && alerts.length === 0 && (
                <div className="empty-state"><div>◎</div><strong>Свежих событий не найдено</strong><p>Это не гарантирует отсутствие угрозы. Проверяйте официальные оповещения.</p></div>
              )}
              {loading && alerts.length === 0 && <div className="feed-loading">Получаем свежие сообщения…</div>}
            </div>

            <div className="source-strip" aria-label="Состояние источников">
              {feed.sources.map((source) => (
                <a href={source.url} target="_blank" rel="noreferrer" key={source.id}><i className={source.reachable ? "ok" : "down"} />{source.label}</a>
              ))}
            </div>
          </section>

          <section className="panel-section telegram-card">
            <div className="telegram-icon">↗</div>
            <div className="telegram-copy">
              <div className="telegram-title">
                <div><p className="eyebrow">ДОСТАВКА · ЛИЧНЫЙ ЧАТ · {radius} КМ</p><h2>Telegram-бот</h2></div>
                <span className={telegramStage === "ready" || telegramStage === "active" ? "ready" : "pending"}>{telegramCopy[telegramStage][0]}</span>
              </div>
              <p>{telegramCopy[telegramStage][1]}</p>
              <div className="telegram-actions">
                <a href="https://t.me/BotFather" target="_blank" rel="noreferrer">Открыть BotFather</a>
                <button type="button" onClick={checkTelegram} disabled={telegramStage === "checking"}>Проверить</button>
              </div>
            </div>
          </section>
        </aside>
      </section>

      <section className="status-grid">
        <article><p>КОНТРОЛИРУЕМАЯ ЗОНА</p><strong>{(Math.PI * radius * radius).toFixed(0)} км²</strong><span>радиус {radius} км</span></article>
        <article><p>ОФИЦИАЛЬНЫЕ ИСТОЧНИКИ</p><strong className={officialSources ? "good-value" : "muted-value"}>{officialSources} / {officialSourcesTotal || 5}</strong><span>МЧС · власти региона и округов</span></article>
        <article><p>МОНИТОРИНГОВЫЕ КАНАЛЫ</p><strong className={monitoringSources ? "good-value" : "muted-value"}>{monitoringSources} / {monitoringSourcesTotal || 15}</strong><span>вторичный слой · требует проверки</span></article>
        <article className="logic-card"><p>ЛОГИКА ОПОВЕЩЕНИЯ</p><div className="logic-flow"><span>Источник</span><b>→</b><span>Место</span><b>→</b><span>Радиус</span><b>→</b><span>Telegram</span></div></article>
      </section>

      <footer><p>АТЛАНТ / WATCH · ПУБЛИЧНЫЕ ИСТОЧНИКИ</p><span>Не заменяет официальные системы оповещения и решения ответственных служб.</span></footer>
    </main>
  );
}
