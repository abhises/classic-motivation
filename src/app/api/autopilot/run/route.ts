import { runAutopilotOnce } from "@/lib/autopilot";
import { getSettings } from "@/lib/store";

/** Run one autopilot cycle now. Also usable from cron: curl -X POST http://localhost:3000/api/autopilot/run */
export function POST() {
  const job = runAutopilotOnce();
  return Response.json({ job: job ?? null, message: getSettings().autopilot.lastMessage });
}
