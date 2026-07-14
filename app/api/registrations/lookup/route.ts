import { supabaseServerFetch } from "../../../../lib/supabase-server";

function digits(value: unknown) {
  return String(value ?? "").replace(/\D/g, "");
}

export async function POST(request: Request) {
  const { phone } = await request.json() as { phone?: string };
  const normalizedPhone = digits(phone);
  if (normalizedPhone.length < 8) return Response.json({ found: false }, { status: 400 });

  const response = await supabaseServerFetch("rpc/encuentro_psicologico_lookup_by_phone", {
    method: "POST",
    body: JSON.stringify({ p_phone: normalizedPhone }),
  });

  if (!response.ok) return Response.json({ error: "No fue posible verificar el teléfono." }, { status: 503 });
  return Response.json(await response.json());
}
