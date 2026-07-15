import { clearSession } from "../../../../lib/auth";

function safeNext(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/acceso";
  return value;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  await clearSession();
  return Response.redirect(new URL(safeNext(url.searchParams.get("next")), request.url), 303);
}
