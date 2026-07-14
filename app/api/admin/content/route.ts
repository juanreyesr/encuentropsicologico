import { env } from "cloudflare:workers";
import { getChatGPTUser } from "../../../chatgpt-auth";

async function authorized() { return Boolean(await getChatGPTUser()); }
async function init() { await env.DB.prepare(`CREATE TABLE IF NOT EXISTS site_content (id INTEGER PRIMARY KEY, payload TEXT NOT NULL, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`).run(); }

export async function GET() {
  if (!await authorized()) return Response.json({ error: "No autorizado" }, { status: 401 });
  await init();
  const row = await env.DB.prepare("SELECT payload, updated_at FROM site_content WHERE id = 1").first();
  return Response.json(row ? { ...JSON.parse(String(row.payload)), updatedAt: row.updated_at } : {});
}

export async function POST(request: Request) {
  if (!await authorized()) return Response.json({ error: "No autorizado" }, { status: 401 });
  await init();
  const payload = await request.json();
  await env.DB.prepare("INSERT INTO site_content (id,payload,updated_at) VALUES (1,?,CURRENT_TIMESTAMP) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload, updated_at=CURRENT_TIMESTAMP").bind(JSON.stringify(payload)).run();
  return Response.json({ ok: true });
}
