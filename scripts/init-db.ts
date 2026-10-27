import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

async function main() {
  await sql`
    CREATE TABLE IF NOT EXISTS play_logs (
      id BIGSERIAL PRIMARY KEY,
      session_id TEXT NOT NULL,
      event_type TEXT NOT NULL,
      payload JSONB NOT NULL DEFAULT '{}'::jsonb,
      client_ts BIGINT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_play_logs_created_at ON play_logs (created_at)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_play_logs_event_type ON play_logs (event_type)`;
  console.log("play_logs table ready");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
