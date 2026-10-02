import type { ReactNode } from "react";
import { Card } from "./card";
import { Skeleton } from "./skeleton";

export function StatCard({
  label,
  value,
  sub,
  icon,
  loading = false,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  icon?: ReactNode;
  loading?: boolean;
}) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="text-sm font-medium text-slate-500">{label}</div>
        {icon && <div className="rounded-lg bg-indigo-50 p-2 text-indigo-600">{icon}</div>}
      </div>
      {loading ? (
        <>
          <Skeleton className="mt-3 h-8 w-24" />
          <Skeleton className="mt-2 h-4 w-16" />
        </>
      ) : (
        <>
          <div className="mt-2 text-3xl font-semibold tracking-tight tabular-nums text-slate-900">{value}</div>
          <div className="mt-1 min-h-5 text-sm text-slate-500 tabular-nums">{sub}</div>
        </>
      )}
    </Card>
  );
}
