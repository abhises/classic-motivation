import path from "node:path";

export const SHORTS_DIR = path.resolve(process.env.SHORTS_DIR || path.join(process.cwd(), "../shorts-maker"));
export const OUTPUT_DIR = path.join(SHORTS_DIR, "output");
export const TOPICS_FILE = path.join(SHORTS_DIR, "topics.txt");
export const TOPICS_DONE_FILE = path.join(SHORTS_DIR, "topics-done.txt");
export const PYTHON_BIN = process.env.PYTHON_BIN || path.join(SHORTS_DIR, ".venv/bin/python");
export const DATA_DIR = path.join(process.cwd(), "data");

export const APP_URL = (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");

/** Resolve a path inside OUTPUT_DIR, refusing anything that escapes it. */
export function outputPath(...parts: string[]): string {
  const full = path.resolve(OUTPUT_DIR, ...parts);
  if (full !== OUTPUT_DIR && !full.startsWith(OUTPUT_DIR + path.sep)) {
    throw new Error("Invalid path");
  }
  return full;
}
