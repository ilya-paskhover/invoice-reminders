import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type Tone = "slate" | "sky" | "rose" | "emerald" | "amber" | "indigo";

const tones: Record<Tone, { pill: string; dot: string }> = {
  slate: { pill: "bg-slate-100 text-slate-700 ring-slate-200", dot: "bg-slate-400" },
  sky: { pill: "bg-sky-50 text-sky-700 ring-sky-200", dot: "bg-sky-500" },
  rose: { pill: "bg-rose-50 text-rose-700 ring-rose-200", dot: "bg-rose-500" },
  emerald: { pill: "bg-emerald-50 text-emerald-700 ring-emerald-200", dot: "bg-emerald-500" },
  amber: { pill: "bg-amber-50 text-amber-700 ring-amber-200", dot: "bg-amber-500" },
  indigo: { pill: "bg-indigo-50 text-indigo-700 ring-indigo-200", dot: "bg-indigo-500" },
};

export function Badge({ tone = "slate", dot = false, children }: { tone?: Tone; dot?: boolean; children: ReactNode }) {
  const t = tones[tone];
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset", t.pill)}>
      {dot && <span className={cn("h-1.5 w-1.5 rounded-full", t.dot)} aria-hidden="true" />}
      {children}
    </span>
  );
}

export function StatusBadge({ status }: { status: "Open" | "Overdue" | "Paid" }) {
  const tone: Tone = status === "Open" ? "sky" : status === "Overdue" ? "rose" : "emerald";
  return (
    <Badge tone={tone} dot>
      {status}
    </Badge>
  );
}
