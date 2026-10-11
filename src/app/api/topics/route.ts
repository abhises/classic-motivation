import { doneTopics, pendingTopics, readTopicsFile, writeTopicsFile } from "@/lib/topics";

export function GET() {
  return Response.json({ text: readTopicsFile(), pending: pendingTopics(), done: doneTopics() });
}

export async function PUT(req: Request) {
  const { text } = (await req.json()) as { text: string };
  writeTopicsFile(String(text ?? ""));
  return Response.json({ text: readTopicsFile(), pending: pendingTopics(), done: doneTopics() });
}
