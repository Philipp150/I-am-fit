"use client";

import Link from "next/link";
import { isCloudEnabled } from "@/lib/env";
import { useSession } from "@/lib/hooks";

export function AuthBanner() {
  const session = useSession();
  if (!isCloudEnabled()) return null;
  if (session === undefined) return null;
  if (session) {
    return (
      <p className="text-xs text-forest-light">
        Angemeldet{session.email ? ` als ${session.email}` : ""}.{" "}
        <Link href="/progress" className="underline">
          Konto
        </Link>
      </p>
    );
  }
  return (
    <p className="rounded-2xl bg-sand/80 px-3 py-2 text-sm text-forest-dark">
      Sammlung ist in der Cloud. Für Plan und eigene Übungen auf PC und Handy:{" "}
      <Link href="/auth" className="underline">
        per E-Mail anmelden
      </Link>
      .
    </p>
  );
}
