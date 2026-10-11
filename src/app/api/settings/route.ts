import { nextRunAt } from "@/lib/autopilot";
import { getSettings, saveSettings } from "@/lib/store";
import type { Settings } from "@/lib/types";

export function GET() {
  return Response.json({ ...getSettings(), nextRunAt: nextRunAt() });
}

export async function PUT(req: Request) {
  const patch = (await req.json()) as Partial<Settings>;
  if (patch.autopilot?.intervalHours !== undefined) {
    patch.autopilot.intervalHours = Math.min(168, Math.max(0.25, Number(patch.autopilot.intervalHours) || 24));
  }
  saveSettings(patch);
  return Response.json({ ...getSettings(), nextRunAt: nextRunAt() });
}
