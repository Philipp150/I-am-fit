"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AuthBanner } from "@/components/AuthBanner";
import { InstallHint } from "@/components/Pwa";
import { BookOpen, CalendarDays, HeartPulse, Sparkles } from "lucide-react";

const NAV = [
  { href: "/", label: "Heute", icon: Sparkles },
  { href: "/catalog", label: "Sammlung", icon: BookOpen },
  { href: "/plan", label: "Plan", icon: CalendarDays },
  { href: "/complaints", label: "Beschwerden", icon: HeartPulse },
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const hideNav = pathname.startsWith("/practice");

  return (
    <div className="mx-auto flex min-h-screen max-w-lg flex-col px-4 pb-28 pt-6 md:max-w-3xl">
      <a
        href="#inhalt"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-forest focus:px-4 focus:py-2 focus:text-cream"
      >
        Zum Inhalt springen
      </a>
      <header className="mb-6 flex items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-forest-light">I am fit</p>
          <h1 className="font-display text-3xl font-medium tracking-tight text-forest-dark">
            <Link href="/" className="rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest">
              Dabei bleiben
            </Link>
          </h1>
          <div className="mt-2">
            <AuthBanner />
          </div>
        </div>
        <Link
          href="/progress"
          className="text-sm text-forest underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest"
        >
          Verlauf
        </Link>
      </header>
      {!hideNav && <InstallHint />}
      <main id="inhalt" className="flex-1">
        {children}
      </main>
      {!hideNav && (
        <nav
          aria-label="Hauptnavigation"
          className="fixed bottom-0 left-0 right-0 z-20 border-t border-sand/80 bg-cream/95 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur"
        >
          <ul className="mx-auto flex max-w-lg justify-between md:max-w-3xl">
            {NAV.map((item) => {
              const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
              const Icon = item.icon;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={`flex flex-col items-center gap-1 rounded-xl px-3 py-1 text-[11px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest ${active ? "text-forest" : "text-forest-dark/80"}`}
                  >
                    <Icon className="h-5 w-5" strokeWidth={active ? 2.4 : 1.8} aria-hidden="true" />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      )}
    </div>
  );
}
