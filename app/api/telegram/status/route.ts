export async function GET() {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  if (!token) return Response.json({ ready: false, stage: "token_missing" });

  try {
    const response = await fetch(
      `https://api.telegram.org/bot${token}/getUpdates?limit=25&allowed_updates=%5B%22message%22%5D`,
      { headers: { accept: "application/json" } },
    );
    const payload = (await response.json()) as {
      ok?: boolean;
      result?: Array<{ message?: { text?: string; chat?: { type?: string } } }>;
    };
    const started = Boolean(
      payload.ok && payload.result?.some((update) => update.message?.chat?.type === "private" && update.message.text?.trim().startsWith("/start")),
    );
    return Response.json({ ready: started, stage: started ? "ready" : "start_required" });
  } catch {
    return Response.json({ ready: false, stage: "unavailable" });
  }
}
