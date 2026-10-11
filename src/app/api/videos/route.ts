import { listVideos } from "@/lib/library";

export function GET() {
  return Response.json(listVideos());
}
