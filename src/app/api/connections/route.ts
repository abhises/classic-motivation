import { connectionStatus } from "@/lib/publish";
import { PLATFORMS } from "@/lib/types";

export function GET() {
  return Response.json(PLATFORMS.map(connectionStatus));
}
