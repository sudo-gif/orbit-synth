export type LogEvent = {
  type: string;
  payload: Record<string, unknown>;
  t: number;
};

const ENDPOINT = (import.meta.env.VITE_LOG_ENDPOINT as string | undefined) ?? "/api/log";
const FLUSH_INTERVAL_MS = 5000;

const sessionId = crypto.randomUUID();
let buffer: LogEvent[] = [];

export function log(type: string, payload: Record<string, unknown> = {}): void {
  buffer.push({ type, payload, t: Date.now() });
}

async function flush(): Promise<void> {
  if (buffer.length === 0) return;
  const batch = buffer;
  buffer = [];
  try {
    await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId, events: batch }),
      keepalive: true,
    });
  } catch {
    // バックエンド未接続時は静かに無視(開発中はコンソールで確認)
    console.debug("[logger] flush skipped (no endpoint yet)", batch);
  }
}

setInterval(flush, FLUSH_INTERVAL_MS);
window.addEventListener("beforeunload", () => {
  flush();
});
