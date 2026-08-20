type SourceKind = "official" | "monitoring";
type AlertStatus = "active" | "watch" | "closed";

type SourceDefinition = {
  id: string;
  label: string;
  kind: SourceKind;
  url: string;
  format: "rss" | "telegram";
};

type RawPost = {
  id: string;
  title: string;
  text: string;
  publishedAt: string;
  url: string;
};

type Place = {
  name: string;
  lat: number;
  lon: number;
  aliases: string[];
};

const SOURCES: SourceDefinition[] = [
  {
    id: "mchs-mo",
    label: "МЧС Московской области",
    kind: "official",
    url: "https://50.mchs.gov.ru/deyatelnost/press-centr/operativnaya-informaciya/shtormovye-i-ekstrennye-preduprezhdeniya/rss",
    format: "rss",
  },
  { id: "vrv-radar", label: "Радар ВРВ", kind: "monitoring", url: "https://t.me/s/vrv_radar", format: "telegram" },
  { id: "lpr1", label: "Lpr 1", kind: "monitoring", url: "https://t.me/s/lpr1_treugolnik", format: "telegram" },
  { id: "locatorru", label: "Локатор России", kind: "monitoring", url: "https://t.me/s/locatorru", format: "telegram" },
  { id: "mchs-mo-telegram", label: "МЧС Московской области · Telegram", kind: "official", url: "https://t.me/s/mchs_mo", format: "telegram" },
  { id: "vorobiev-live", label: "Воробьёв LIVE", kind: "official", url: "https://t.me/s/vorobiev_live", format: "telegram" },
  { id: "mos-sobyanin", label: "Сергей Собянин", kind: "official", url: "https://t.me/s/mos_sobyanin", format: "telegram" },
  { id: "bogorodsky-okrug", label: "Администрация Богородского округа", kind: "official", url: "https://t.me/s/bogorodskyokrug", format: "telegram" },
  { id: "radar-moscow-99", label: "Радар · Москва и область", kind: "monitoring", url: "https://t.me/s/Radar_Moscow_99", format: "telegram" },
  { id: "radar-moscoww", label: "Радар Москва", kind: "monitoring", url: "https://t.me/s/radar_moscoww", format: "telegram" },
  { id: "radar-russia", label: "Радар по всей России", kind: "monitoring", url: "https://t.me/s/radarrussiia", format: "telegram" },
  { id: "radar-plus", label: "Радар ПЛЮС", kind: "monitoring", url: "https://t.me/s/radar_plus_bpla", format: "telegram" },
  { id: "lpr-alarm", label: "LPR · оповещения", kind: "monitoring", url: "https://t.me/s/LPRalarm", format: "telegram" },
  { id: "ostorozhno-moskva", label: "Осторожно, Москва", kind: "monitoring", url: "https://t.me/s/ostorozhno_moskva", format: "telegram" },
  { id: "moscowmap", label: "Новости Москвы", kind: "monitoring", url: "https://t.me/s/moscowmap", format: "telegram" },
  { id: "moscowtop", label: "Москва с огоньком", kind: "monitoring", url: "https://t.me/s/moscowtop", format: "telegram" },
  { id: "infomoscow24", label: "Москва 24", kind: "monitoring", url: "https://t.me/s/infomoscow24", format: "telegram" },
  { id: "bfm-news", label: "BFM", kind: "monitoring", url: "https://t.me/s/BFMnews", format: "telegram" },
  { id: "msk1-news", label: "MSK1.RU", kind: "monitoring", url: "https://t.me/s/msk1_news", format: "telegram" },
  { id: "bogorodsky-online", label: "Богородский онлайн", kind: "monitoring", url: "https://t.me/s/bgoonline", format: "telegram" },
];

const PLACES: Place[] = [
  { name: "Атлант‑Парк", lat: 55.821573, lon: 38.246878, aliases: ["атлант-парк", "атлант парк"] },
  { name: "Обухово", lat: 55.8328, lon: 38.2725, aliases: ["обухово"] },
  { name: "Старая Купавна", lat: 55.8073, lon: 38.1772, aliases: ["старая купавна", "старой купавне"] },
  { name: "Электроугли", lat: 55.7162, lon: 38.2197, aliases: ["электроугли", "электроуглях"] },
  { name: "Ногинск", lat: 55.8545, lon: 38.4417, aliases: ["ногинск", "богородский городской округ", "богородского городского округа"] },
  { name: "Электросталь", lat: 55.7847, lon: 38.4447, aliases: ["электросталь", "электростали"] },
  { name: "Монино", lat: 55.8425, lon: 38.1944, aliases: ["монино"] },
  { name: "Лосино-Петровский", lat: 55.8713, lon: 38.2006, aliases: ["лосино-петровский", "лосино петровский"] },
  { name: "Балашиха", lat: 55.7963, lon: 37.9382, aliases: ["балашиха", "балашихе"] },
  { name: "Щёлково", lat: 55.9202, lon: 37.9915, aliases: ["щёлково", "щелково", "щелковский"] },
  { name: "Фрязино", lat: 55.9603, lon: 38.0456, aliases: ["фрязино"] },
  { name: "Павловский Посад", lat: 55.7807, lon: 38.6506, aliases: ["павловский посад", "павловском посаде"] },
  { name: "Раменское", lat: 55.5669, lon: 38.2303, aliases: ["раменское", "раменском"] },
  { name: "Жуковский", lat: 55.5978, lon: 38.1195, aliases: ["жуковский", "жуковском"] },
];

const REGION_ALIASES = ["московская область", "московской области", "московский регион", "подмосковье", "подмосковья", "москва"];
const SAFETY_KEYWORDS = ["опасност", "угроз", "бпла", "беспилот", "ракет", "пво", "воздушн", "обстрел", "отбой", "экстренное предупреждение"];
const DRONE_KEYWORDS = ["бпла", "беспилот", "дрон"];

function decodeEntities(value: string) {
  const named: Record<string, string> = { amp: "&", quot: '"', apos: "'", lt: "<", gt: ">", nbsp: " " };
  return value
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&([a-z]+);/gi, (entity, name: string) => named[name.toLowerCase()] ?? entity);
}

function plainText(value: string) {
  return decodeEntities(value.replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, " "))
    .replace(/[\t\r ]+/g, " ")
    .replace(/\n\s+/g, "\n")
    .trim();
}

function tagValue(block: string, tag: string) {
  const match = block.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return match ? plainText(match[1].replace(/^<!\[CDATA\[|\]\]>$/g, "")) : "";
}

function parseRss(xml: string): RawPost[] {
  return [...xml.matchAll(/<item(?:\s[^>]*)?>([\s\S]*?)<\/item>/gi)]
    .slice(0, 16)
    .map((match, index) => {
      const block = match[1];
      const title = tagValue(block, "title");
      const description = tagValue(block, "description");
      const link = tagValue(block, "link");
      return {
        id: tagValue(block, "guid") || link || `mchs-${index}`,
        title: title || "Экстренное предупреждение МЧС",
        text: [title, description].filter(Boolean).join(". "),
        publishedAt: tagValue(block, "pubDate"),
        url: link,
      };
    });
}

function parseTelegram(html: string, channelUrl: string): RawPost[] {
  const markers = [...html.matchAll(/data-post="([^"]+)"/g)];
  const posts: RawPost[] = [];
  for (let index = 0; index < markers.length; index += 1) {
    const marker = markers[index];
    const start = marker.index ?? 0;
    const end = markers[index + 1]?.index ?? html.length;
    const segment = html.slice(start, end);
    const textMatch = segment.match(/tgme_widget_message_text[^>]*>([\s\S]*?)(?:<div class="tgme_widget_message_footer|<time\b)/i);
    const dateMatch = segment.match(/<time[^>]*datetime="([^"]+)"/i);
    const text = textMatch ? plainText(textMatch[1]) : "";
    if (!text) continue;
    const postPath = marker[1];
    posts.push({
      id: postPath,
      title: text.split("\n")[0].slice(0, 150),
      text,
      publishedAt: dateMatch?.[1] ?? "",
      url: postPath ? `https://t.me/${postPath}` : channelUrl,
    });
  }
  return posts.slice(-24);
}

async function fetchText(url: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 7500);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        accept: "text/html,application/rss+xml,application/xml;q=0.9,*/*;q=0.8",
        "user-agent": "Atlant-Watch/1.0 (+public safety feed reader)",
      },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.text();
  } finally {
    clearTimeout(timeout);
  }
}

function findPlace(text: string) {
  const normalized = text.toLowerCase().replace(/ё/g, "е");
  const place = PLACES.find((candidate) => candidate.aliases.some((alias) => normalized.includes(alias.replace(/ё/g, "е"))));
  if (place) return { ...place, scope: "local" as const };
  const isRegional = REGION_ALIASES.some((alias) => normalized.includes(alias.replace(/ё/g, "е")));
  if (isRegional) return { name: "Московский регион", lat: null, lon: null, scope: "regional" as const };
  return null;
}

function alertStatus(text: string): AlertStatus {
  const normalized = text.toLowerCase();
  if (/отбой|опасность снята|угроза миновала/.test(normalized)) return "closed";
  if (/возможн|предварительно|внимание|режим готовности/.test(normalized)) return "watch";
  return "active";
}

function isRelevantMonitoringPost(text: string) {
  const normalized = text.toLowerCase();
  return SAFETY_KEYWORDS.some((keyword) => normalized.includes(keyword)) && Boolean(findPlace(text));
}

function isDronePost(text: string) {
  const normalized = text.toLowerCase();
  return DRONE_KEYWORDS.some((keyword) => normalized.includes(keyword));
}

function safeDate(value: string) {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : new Date().toISOString();
}

export async function GET() {
  const checkedAt = new Date().toISOString();
  const results = await Promise.all(
    SOURCES.map(async (source) => {
      try {
        const body = await fetchText(source.url);
        const posts = source.format === "rss" ? parseRss(body) : parseTelegram(body, source.url);
        const relevant = source.kind === "official"
          ? posts.filter((post) => isDronePost(post.text))
          : posts.filter((post) => isRelevantMonitoringPost(post.text));
        const alerts = relevant.map((post) => {
          const place = findPlace(post.text) ?? { name: "Московская область", lat: null, lon: null, scope: "regional" as const };
          return {
            id: `${source.id}:${post.id}`,
            title: post.title,
            text: post.text.slice(0, 700),
            location: place.name,
            lat: place.lat,
            lon: place.lon,
            scope: place.scope,
            source: source.label,
            sourceId: source.id,
            sourceUrl: post.url || source.url,
            sourceType: source.kind,
            status: alertStatus(post.text),
            publishedAt: safeDate(post.publishedAt),
          };
        });
        return {
          source: { id: source.id, label: source.label, kind: source.kind, url: source.url, reachable: true, matched: alerts.length },
          alerts,
        };
      } catch {
        return {
          source: { id: source.id, label: source.label, kind: source.kind, url: source.url, reachable: false, matched: 0 },
          alerts: [],
        };
      }
    }),
  );

  const alerts = results.flatMap((result) => result.alerts).sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt)).slice(0, 40);
  return Response.json(
    { checkedAt, alerts, sources: results.map((result) => result.source), notice: "Мониторинговые каналы являются вторичными источниками и требуют подтверждения." },
    { headers: { "cache-control": "public, s-maxage=60, stale-while-revalidate=120" } },
  );
}
