import fs from "node:fs";
import path from "node:path";
import { outputPath } from "@/lib/paths";

const TYPES: Record<string, string> = {
  ".mp4": "video/mp4",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".json": "application/json",
  ".txt": "text/plain; charset=utf-8",
};

/** Node file stream -> web stream that stops cleanly when the player aborts the request. */
function fileStream(file: string, range?: { start: number; end: number }): ReadableStream<Uint8Array> {
  const node = fs.createReadStream(file, range);
  let closed = false;
  return new ReadableStream({
    start(controller) {
      node.on("data", (chunk) => {
        if (closed) return;
        controller.enqueue(new Uint8Array(chunk as Buffer));
        if ((controller.desiredSize ?? 1) <= 0) node.pause();
      });
      node.on("end", () => {
        if (!closed) {
          closed = true;
          controller.close();
        }
      });
      node.on("error", (e) => {
        if (!closed) {
          closed = true;
          controller.error(e);
        }
      });
    },
    pull() {
      node.resume();
    },
    cancel() {
      closed = true;
      node.destroy();
    },
  });
}

/** Serves files from the shorts-maker output folder, with Range support so videos can seek. */
export async function GET(req: Request, ctx: RouteContext<"/api/media/[...path]">) {
  let file: string;
  try {
    file = outputPath(...(await ctx.params).path);
  } catch {
    return new Response("Bad path", { status: 400 });
  }
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) return new Response("Not found", { status: 404 });

  const size = fs.statSync(file).size;
  const type = TYPES[path.extname(file).toLowerCase()] ?? "application/octet-stream";
  const headers: Record<string, string> = { "Content-Type": type, "Accept-Ranges": "bytes", "Cache-Control": "no-cache" };

  const m = /bytes=(\d*)-(\d*)/.exec(req.headers.get("range") ?? "");
  if (m && (m[1] || m[2])) {
    const start = m[1] ? Number(m[1]) : Math.max(0, size - Number(m[2]));
    const end = m[1] && m[2] ? Math.min(Number(m[2]), size - 1) : size - 1;
    if (start >= size || start > end) {
      return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
    }
    return new Response(fileStream(file, { start, end }), {
      status: 206,
      headers: { ...headers, "Content-Range": `bytes ${start}-${end}/${size}`, "Content-Length": String(end - start + 1) },
    });
  }
  return new Response(fileStream(file), { headers: { ...headers, "Content-Length": String(size) } });
}
