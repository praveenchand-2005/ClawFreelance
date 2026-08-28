import { NextRequest, NextResponse } from "next/server";
import { searchProjects } from "@/lib/freelancer-operator/client";
import { scoreProject } from "@/lib/freelancer-operator/scoring";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("query") ?? undefined;
  const limit = Math.min(Number(request.nextUrl.searchParams.get("limit") ?? 20), 50);

  try {
    const response = await searchProjects({ query, limit });
    const projects = response.result?.projects ?? [];

    return NextResponse.json({
      projects: projects.map((project) => ({
        ...project,
        operator: scoreProject(project),
      })),
      total: response.result?.total_count ?? projects.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to query Freelancer";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
