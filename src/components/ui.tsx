import type { ButtonHTMLAttributes, ReactNode } from "react";
import type { ExerciseKind } from "@/lib/types";

export const KIND_LABELS: Record<ExerciseKind, string> = {
  movement: "Bewegung",
  breath: "Atem",
  mantra: "Mantra",
  mind: "Geist",
  other: "Andere",
};

export function KindBadge({ kind }: { kind: ExerciseKind }) {
  return (
    <span className="rounded-full bg-sage/50 px-2.5 py-0.5 text-[11px] uppercase tracking-wider text-forest-dark">
      {KIND_LABELS[kind]}
    </span>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-[1.6rem] border border-sand/80 bg-cream p-4 shadow-card ${className}`}>{children}</section>;
}

export function PrimaryButton({
  children,
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={`inline-flex items-center justify-center rounded-full bg-forest px-5 py-3 text-sm font-medium text-cream disabled:opacity-50 ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export function SecondaryButton({
  children,
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={`inline-flex items-center justify-center rounded-full border border-forest/20 bg-white/50 px-5 py-3 text-sm font-medium text-forest disabled:opacity-50 ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs uppercase tracking-[0.16em] text-forest-light">{label}</span>
      {children}
    </label>
  );
}

export const fieldClass =
  "w-full rounded-2xl border border-sand bg-white/70 px-3 py-2.5 text-ink outline-none ring-forest/30 focus:ring-2";
