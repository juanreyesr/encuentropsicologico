import { DEFAULT_PROGRAM, type EventProgramItem } from "../../../lib/event";
import { supabaseServerFetch } from "../../../lib/supabase-server";

export const dynamic = "force-dynamic";

export async function GET() {
  const response = await supabaseServerFetch("encuentro_psicologico_program?select=id,start_time,end_time,type,title,description,details,display_order,is_published&is_published=eq.true&order=display_order.asc,id.asc");
  if (!response.ok) return Response.json({ program: DEFAULT_PROGRAM });
  const program = await response.json() as EventProgramItem[];
  return Response.json({ program: program.length > 0 ? program : DEFAULT_PROGRAM });
}
