import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

type LogEvent = { type: string; payload: Record<string, unknown>; t: number };
type LogBody = { sessionId: string; events: LogEvent[] };

export const config = { runtime: "nodejs" };

export async function POST(req: Request): Promise<Response> {
  let body: LogBody;
  try {
    body = await req.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  if (!body.sessionId || !Array.isArray(body.events) || body.events.length === 0) {
    return new Response("Invalid payload", { status: 400 });
  }

  const rows = body.events.slice(0, 200).map((e) => [
    body.sessionId,
    String(e.type).slice(0, 64),
    JSON.stringify(e.payload ?? {}),
    Number(e.t) || Date.now(),
  ]);

  try {
    await Promise.all(
      rows.map(([sessionId, eventType, payload, clientTs]) =>
        sql`INSERT INTO play_logs (session_id, event_type, payload, client_ts)
            VALUES (${sessionId}, ${eventType}, ${payload}::jsonb, ${clientTs})`
      )
    );
  } catch (err) {
    console.error("log insert failed", err);
    return new Response("Internal Error", { status: 500 });
  }

  return new Response(JSON.stringify({ ok: true, inserted: rows.length }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
