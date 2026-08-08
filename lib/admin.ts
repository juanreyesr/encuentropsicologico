import { currentUser, hasAdminSession, startAdminSession } from "./auth";

export async function isEventAdmin() {
  const user = await currentUser();
  if (user?.app_metadata?.encuentro_psicologico_role === "admin") {
    await startAdminSession(user);
    return true;
  }
  return await hasAdminSession();
}
