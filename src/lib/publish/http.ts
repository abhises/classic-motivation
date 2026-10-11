export class ApiError extends Error {}

/** fetch that throws a readable error for non-2xx responses and returns parsed JSON. */
export async function fetchJson<T = Record<string, unknown>>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const text = await res.text();
  let body: unknown = text;
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    /* keep text */
  }
  if (!res.ok) {
    const msg = typeof body === "string" ? body : JSON.stringify(body);
    throw new ApiError(`${res.status} ${url.split("?")[0]}: ${msg.slice(0, 500)}`);
  }
  return body as T;
}

export function form(data: Record<string, string>) {
  return { "Content-Type": "application/x-www-form-urlencoded", body: new URLSearchParams(data).toString() };
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
