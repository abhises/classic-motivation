import fs from "node:fs";
import { TOPICS_DONE_FILE, TOPICS_FILE } from "./paths";

const isTopic = (l: string) => l.trim() !== "" && !l.trim().startsWith("#");

export function readTopicsFile(): string {
  return fs.existsSync(TOPICS_FILE) ? fs.readFileSync(TOPICS_FILE, "utf8") : "";
}

export function writeTopicsFile(text: string) {
  fs.writeFileSync(TOPICS_FILE, text.endsWith("\n") ? text : text + "\n");
}

export function pendingTopics(): string[] {
  return readTopicsFile().split("\n").filter(isTopic).map((l) => l.trim());
}

export function doneTopics(): string[] {
  if (!fs.existsSync(TOPICS_DONE_FILE)) return [];
  return fs.readFileSync(TOPICS_DONE_FILE, "utf8").split("\n").filter(Boolean).reverse().slice(0, 50);
}

/** Remove the first pending topic from topics.txt and log it to topics-done.txt. */
export function popTopic(): string | undefined {
  const lines = readTopicsFile().split("\n");
  const i = lines.findIndex(isTopic);
  if (i < 0) return undefined;
  const topic = lines[i].trim();
  lines.splice(i, 1);
  fs.writeFileSync(TOPICS_FILE, lines.join("\n"));
  fs.appendFileSync(TOPICS_DONE_FILE, `${new Date().toISOString()}\t${topic}\n`);
  return topic;
}
