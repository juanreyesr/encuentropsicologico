import { currentUser } from "./auth";

export async function isEventAdmin() {
  const user = await currentUser();
  return user?.app_metadata?.encuentro_psicologico_role === "admin";
}
