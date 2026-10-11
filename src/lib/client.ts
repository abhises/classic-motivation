"use client";
import { useCallback, useEffect, useRef, useState } from "react";

/** Fetch JSON from `url` every `ms` milliseconds (pauses while the tab is hidden). */
export function usePoll<T>(url: string | null, ms: number) {
  // results are tagged with their url so a stale response never shows under a new url
  const [result, setResult] = useState<{ url: string; data?: T; error?: string }>();
  const urlRef = useRef(url);
  useEffect(() => {
    urlRef.current = url;
  }, [url]);

  const refresh = useCallback(async () => {
    const u = urlRef.current;
    if (!u) return;
    try {
      const res = await fetch(u, { cache: "no-store" });
      if (!res.ok) throw new Error(`${res.status}`);
      const json = (await res.json()) as T;
      if (urlRef.current === u) setResult({ url: u, data: json });
    } catch (e) {
      if (urlRef.current === u) setResult((r) => ({ url: u, data: r?.url === u ? r.data : undefined, error: String(e) }));
    }
  }, []);

  useEffect(() => {
    if (!url) return;
    urlRef.current = url;
    void refresh();
    const t = setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, ms);
    return () => clearInterval(t);
  }, [url, ms, refresh]);

  const current = url && result?.url === url ? result : undefined;
  return { data: current?.data, error: current?.error, refresh };
}

export async function api<T = unknown>(url: string, method = "POST", body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((json as { error?: string }).error || `Request failed (${res.status})`);
  return json as T;
}

export const media = (p: string) => `/api/media/${p.split("/").map(encodeURIComponent).join("/")}`;

export function timeAgo(iso?: string) {
  if (!iso) return "";
  const s = Math.round((Date.now() - Date.parse(iso)) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export function elapsed(from?: string, to?: string) {
  if (!from) return "";
  const s = Math.max(0, Math.round(((to ? Date.parse(to) : Date.now()) - Date.parse(from)) / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export const VOICES = [
  { id: "en-US-AndrewNeural", label: "Andrew (US, warm male)" },
  { id: "en-US-BrianNeural", label: "Brian (US, casual male)" },
  { id: "en-US-GuyNeural", label: "Guy (US, male)" },
  { id: "en-US-AvaNeural", label: "Ava (US, female)" },
  { id: "en-US-EmmaNeural", label: "Emma (US, female)" },
  { id: "en-US-JennyNeural", label: "Jenny (US, female)" },
  { id: "en-GB-RyanNeural", label: "Ryan (UK, male)" },
  { id: "en-GB-SoniaNeural", label: "Sonia (UK, female)" },
  { id: "en-AU-WilliamNeural", label: "William (AU, male)" },
  { id: "en-IN-PrabhatNeural", label: "Prabhat (India, male)" },
  { id: "en-IN-NeerjaNeural", label: "Neerja (India, female)" },
  // non-English voices also switch the script language (see VOICE_LANGS in make_short.py)
  { id: "ne-NP-SagarNeural", label: "Sagar (Nepali, male)" },
  { id: "ne-NP-HemkalaNeural", label: "Hemkala (Nepali, female)" },
];
