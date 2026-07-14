import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { supabaseServerConfiguration } from "./supabase-server";
import { createHmac, timingSafeEqual } from "crypto";

const ACCESS_COOKIE = "encuentro_access";
const REFRESH_COOKIE = "encuentro_refresh";
const PARTICIPANT_COOKIE = "encuentro_participant";

export type AuthUser = { id: string; email: string; app_metadata?: Record<string, unknown>; user_metadata?: Record<string, unknown>; eventOnly?: boolean };

async function authFetch(path: string, init: RequestInit = {}, accessToken?: string) {
  const { projectUrl, secretKey } = supabaseServerConfiguration();
  return fetch(`${projectUrl}/auth/v1/${path}`, { ...init, headers: { apikey: secretKey, Authorization: `Bearer ${accessToken ?? secretKey}`, "Content-Type": "application/json", ...(init.headers ?? {}) }, cache: "no-store" });
}

async function restFetch(path: string, init: RequestInit = {}) {
  const { projectUrl, secretKey } = supabaseServerConfiguration();
  return fetch(`${projectUrl}/rest/v1/${path}`, { ...init, headers: { apikey: secretKey, Authorization: `Bearer ${secretKey}`, "Content-Type": "application/json", ...(init.headers ?? {}) }, cache: "no-store" });
}

function signPayload(payload: string) {
  const { secretKey } = supabaseServerConfiguration();
  return createHmac("sha256", secretKey).update(payload).digest("base64url");
}

function encodeParticipantSession(user: AuthUser) {
  const payload = Buffer.from(JSON.stringify({ id: user.id, email: user.email, exp: Date.now() + 1000 * 60 * 60 * 24 * 30 })).toString("base64url");
  return `${payload}.${signPayload(payload)}`;
}

function decodeParticipantSession(value?: string): AuthUser | null {
  if (!value) return null;
  const [payload, signature] = value.split(".");
  if (!payload || !signature) return null;
  const expected = signPayload(payload);
  const expectedBuffer = Buffer.from(expected);
  const signatureBuffer = Buffer.from(signature);
  if (expectedBuffer.length !== signatureBuffer.length || !timingSafeEqual(expectedBuffer, signatureBuffer)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { id?: string; email?: string; exp?: number };
    if (!data.id || !data.email || !data.exp || data.exp < Date.now()) return null;
    return { id: data.id, email: data.email, app_metadata: { encuentro_psicologico_role: "participant" }, eventOnly: true };
  } catch {
    return null;
  }
}

export async function findAuthUserIdByEmail(email: string) {
  const response = await restFetch("rpc/encuentro_psicologico_auth_user_id", { method: "POST", body: JSON.stringify({ p_email: email }) });
  if (!response.ok) return null;
  return response.json() as Promise<string | null>;
}

export async function startParticipantSession(user: AuthUser) {
  const jar = await cookies();
  const secure = process.env.NODE_ENV === "production";
  jar.set(PARTICIPANT_COOKIE, encodeParticipantSession(user), { httpOnly: true, secure, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 30 });
}

async function findParticipantByPhone(email: string, phone: string) {
  const userId = await findAuthUserIdByEmail(email);
  if (!userId) return null;
  const response = await restFetch(`encuentro_psicologico_profiles?select=user_id&user_id=eq.${encodeURIComponent(userId)}&phone=eq.${encodeURIComponent(phone)}&limit=1`);
  if (!response.ok) return null;
  const [profile] = await response.json() as Array<{ user_id: string }>;
  if (!profile) return null;
  const user = { id: profile.user_id, email, app_metadata: { encuentro_psicologico_role: "participant" }, eventOnly: true };
  await startParticipantSession(user);
  return user;
}

export async function signIn(email: string, password: string) {
  const normalizedPhone = password.replace(/\s+/g, "");
  const response = await authFetch("token?grant_type=password", { method: "POST", body: JSON.stringify({ email, password: normalizedPhone }) });
  if (!response.ok) return findParticipantByPhone(email, normalizedPhone);
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
  const access = jar.get(ACCESS_COOKIE)?.value;
  if (access) {
    const response = await authFetch("user", {}, access);
    if (response.ok) return response.json() as Promise<AuthUser>;
  }
  const refresh = jar.get(REFRESH_COOKIE)?.value;
  if (refresh) {
    const refreshed = await authFetch("token?grant_type=refresh_token", { method: "POST", body: JSON.stringify({ refresh_token: refresh }) });
    if (refreshed.ok) {
      const session = await refreshed.json() as { access_token: string; refresh_token: string; expires_in: number; user: AuthUser };
      await storeSession(session);
      return session.user;
    }
  }
  return decodeParticipantSession(jar.get(PARTICIPANT_COOKIE)?.value);
}

export async function clearSession() {
  const jar = await cookies();
  jar.delete(ACCESS_COOKIE); jar.delete(REFRESH_COOKIE); jar.delete(PARTICIPANT_COOKIE);
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
