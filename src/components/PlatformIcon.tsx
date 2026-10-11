import type { Platform } from "@/lib/types";

export function PlatformIcon({ platform, className = "h-4 w-4" }: { platform: Platform; className?: string }) {
  if (platform === "youtube") {
    return (
      <svg viewBox="0 0 24 24" className={className} aria-hidden>
        <rect x="1.5" y="4.5" width="21" height="15" rx="4.5" fill="#ff0033" />
        <path d="M10 8.8v6.4l5.6-3.2z" fill="#fff" />
      </svg>
    );
  }
  if (platform === "instagram") {
    return (
      <svg viewBox="0 0 24 24" className={className} aria-hidden>
        <defs>
          <linearGradient id="ig" x1="0" y1="1" x2="1" y2="0">
            <stop offset="0" stopColor="#feda75" />
            <stop offset=".35" stopColor="#fa7e1e" />
            <stop offset=".65" stopColor="#d62976" />
            <stop offset="1" stopColor="#4f5bd5" />
          </linearGradient>
        </defs>
        <rect x="2" y="2" width="20" height="20" rx="6" fill="url(#ig)" />
        <circle cx="12" cy="12" r="4.3" fill="none" stroke="#fff" strokeWidth="1.8" />
        <circle cx="17.3" cy="6.7" r="1.2" fill="#fff" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <rect x="1" y="1" width="22" height="22" rx="6" fill="#111" />
      <path
        d="M15.6 5.5c.4 1.5 1.5 2.6 3 2.9v2.4a6 6 0 0 1-3-.9v4.8a4.6 4.6 0 1 1-4-4.6v2.5a2.2 2.2 0 1 0 1.6 2.1V5.5z"
        fill="#fff"
      />
      <path d="M15.1 5.1c.4 1.5 1.5 2.6 3 2.9" stroke="#25f4ee" strokeWidth=".8" fill="none" />
    </svg>
  );
}
