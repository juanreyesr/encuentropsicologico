import { clearSession } from "../../lib/auth";
export async function GET(request: Request) {
  await clearSession();
  return Response.redirect(new URL("/", request.url), 303);
}
