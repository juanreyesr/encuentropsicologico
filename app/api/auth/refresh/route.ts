import { refreshSession } from "../../../../lib/auth";

function safeNext(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/mi-cuenta";
  return value;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const next = safeNext(url.searchParams.get("next"));
  const user = await refreshSession();
  if (!user) return Response.redirect(new URL(`/acceso?next=${encodeURIComponent(next)}`, request.url), 303);
  return Response.redirect(new URL(next, request.url), 303);
}
