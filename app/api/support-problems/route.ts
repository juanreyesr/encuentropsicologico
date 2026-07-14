import { supabaseServerFetch } from "../../../lib/supabase-server";

function digits(value: unknown) {
  return String(value ?? "").replace(/\D/g, "");
}

export async function POST(request: Request) {
  const { phone, problem } = await request.json() as { phone?: string; problem?: string };
  const normalizedPhone = digits(phone);
  const text = problem?.trim();
  if (normalizedPhone.length < 8 || !text || text.length < 4) return Response.json({ error: "Escribe tu teléfono y describe el problema." }, { status: 400 });

  const response = await supabaseServerFetch("encuentro_psicologico_support_issues", {
    method: "POST",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ phone: normalizedPhone, problem: text, status: "open" }),
  });

  if (!response.ok) return Response.json({ error: "No fue posible enviar el problema." }, { status: 503 });
  return Response.json({ ok: true });
}
