import { supabaseServerFetch } from "../../../../lib/supabase-server";

type PublicResource = {
  id: number;
  category_id: number;
  title: string;
  description: string | null;
  created_at: string;
};

type PublicCategory = {
  id: number;
  name: string;
};

export const dynamic = "force-dynamic";

export async function GET() {
  const [resourceResponse, categoryResponse] = await Promise.all([
    supabaseServerFetch(
      "encuentro_psicologico_community_resources?select=id,category_id,title,description,created_at&status=eq.approved&order=created_at.desc",
    ),
    supabaseServerFetch(
      "encuentro_psicologico_community_categories?select=id,name&is_active=eq.true",
    ),
  ]);

  if (!resourceResponse.ok || !categoryResponse.ok) {
    return Response.json(
      { error: "No se pudo cargar el catálogo público." },
      { status: 503 },
    );
  }

  const resources = (await resourceResponse.json()) as PublicResource[];
  const categories = (await categoryResponse.json()) as PublicCategory[];
  const categoryNames = new Map(categories.map((category) => [category.id, category.name]));

  return Response.json(
    {
      resources: resources.map((resource) => ({
        id: resource.id,
        title: resource.title,
        description: resource.description,
        category: categoryNames.get(resource.category_id) ?? "Recurso",
      })),
    },
    {
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
      },
    },
  );
}
