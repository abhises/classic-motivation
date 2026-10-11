import { createJob, listJobs } from "@/lib/jobs";
import { PLATFORMS, type Platform } from "@/lib/types";

export function GET() {
  return Response.json(listJobs());
}

export async function POST(req: Request) {
  const body = (await req.json()) as { topic?: string; voice?: string; autoPost?: string[] };
  const topic = body.topic?.trim();
  if (!topic) return Response.json({ error: "Topic is required" }, { status: 400 });
  const autoPost = (body.autoPost ?? []).filter((p): p is Platform => PLATFORMS.includes(p as Platform));
  return Response.json(createJob({ topic, voice: body.voice || undefined, autoPost }));
}
