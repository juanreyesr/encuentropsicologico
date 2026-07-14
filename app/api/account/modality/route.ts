import { redirect } from "next/navigation";
import { currentUser } from "../../../../lib/auth";
import { supabaseServerFetch } from "../../../../lib/supabase-server";

export async function POST() {
  const user = await currentUser();
  if (!user) redirect("/acceso?next=/mi-cuenta");

  const response = await supabaseServerFetch("rpc/encuentro_psicologico_switch_presencial_to_virtual", {
    method: "POST",
    body: JSON.stringify({ p_user_id: user.id }),
  });

  if (!response.ok) redirect("/mi-cuenta?cambio=no-disponible");
  const result = await response.json() as { status?: string };
  redirect(`/mi-cuenta?cambio=${encodeURIComponent(result.status ?? "procesado")}`);
}
