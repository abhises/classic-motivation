"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Studio", icon: "M4 5h16v11H4zM8 20h8M12 16v4" },
  { href: "/library", label: "Library", icon: "M4 4h6v16H4zM14 4h6v7h-6zM14 15h6v5h-6z" },
  { href: "/autopilot", label: "Autopilot", icon: "M12 3v3M12 18v3M3 12h3M18 12h3M6 6l2 2M16 16l2 2M6 18l2-2M16 8l2-2M12 8a4 4 0 1 1 0 8 4 4 0 0 1 0-8z" },
  { href: "/accounts", label: "Accounts", icon: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0" },
];

export function Nav() {
  const path = usePathname();
  return (
    <nav className="flex gap-1 md:flex-col">
      {LINKS.map((l) => {
        const active = l.href === "/" ? path === "/" : path.startsWith(l.href);
        return (
          <Link
            key={l.href}
            href={l.href}
            className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition ${
              active ? "bg-white/10 text-white" : "text-zinc-400 hover:bg-white/5 hover:text-zinc-200"
            }`}
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d={l.icon} />
            </svg>
            <span className="hidden sm:inline">{l.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
