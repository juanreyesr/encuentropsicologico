import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { supabaseServerConfiguration } from "./supabase-server";

const ACCESS_COOKIE = "encuentro_access";
const REFRESH_COOKIE = "encuentro_refresh";

export type AuthUser = { id: string; email: string; app_metadata?: Record<string, unknown>; user_metadata?: Record<string, unknown> };

async function authFetch(path: string, init: RequestInit = {}, accessToken?: string) {
  const { projectUrl, secretKey } = supabaseServerConfiguration();
  return fetch(`${projectUrl}/auth/v1/${path}`, { ...init, headers: { apikey: secretKey, ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}), "Content-Type": "application/json", ...(init.headers ?? {}) }, cache: "no-store" });
}

export async function signIn(email: string, password: string) {
  const response = await authFetch("token?grant_type=password", { method: "POST", body: JSON.stringify({ email, password }) });
  if (!response.ok) return null;
  const session = await response.json() as { access_token: string; refresh_token: string; expires_in: number; user: AuthUser };
  await storeSession(session);
  return session.user;
}

export async function createParticipant(email: string, password: string, metadata: Record<string, unknown>) {
  const response = await authFetch("admin/users", { method: "POST", body: JSON.stringify({ email, password, email_confirm: true, user_metadata: metadata, app_metadata: { encuentro_psicologico_role: "participant" } }) });
  if (!response.ok) return null;
  return response.json() as Promise<AuthUser>;
}

async function storeSession(session: { access_token: string; refresh_token: string; expires_in: number }) {
  const jar = await cookies();
  const secure = process.env.NODE_ENV === "production";
  jar.set(ACCESS_COOKIE, session.access_token, { httpOnly: true, secure, sameSite: "lax", path: "/", maxAge: session.expires_in });
  jar.set(REFRESH_COOKIE, session.refresh_token, { httpOnly: true, secure, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 30 });
}

export async function currentUser(): Promise<AuthUser | null> {
  const jar = await cookies();
  let access = jar.get(ACCESS_COOKIE)?.value;
  if (access) {
    const response = await authFetch("user", {}, access);
    if (response.ok) return response.json() as Promise<AuthUser>;
  }
  const refresh = jar.get(REFRESH_COOKIE)?.value;
  if (!refresh) return null;
  const refreshed = await authFetch("token?grant_type=refresh_token", { method: "POST", body: JSON.stringify({ refresh_token: refresh }) });
  if (!refreshed.ok) return null;
  const session = await refreshed.json() as { access_token: string; refresh_token: string; expires_in: number; user: AuthUser };
  await storeSession(session);
  return session.user;
}

export async function clearSession() {
  const jar = await cookies();
  jar.delete(ACCESS_COOKIE); jar.delete(REFRESH_COOKIE);
}

export async function requireUser(returnTo = "/mi-cuenta") {
  const user = await currentUser();
  if (!user) redirect(`/acceso?next=${encodeURIComponent(returnTo)}`);
  return user;
}

export async function requireAdmin() {
  const user = await currentUser();
  if (!user) redirect("/acceso?next=/admin");
  if (user.app_metadata?.encuentro_psicologico_role !== "admin") redirect("/mi-cuenta");
  return user;
}
