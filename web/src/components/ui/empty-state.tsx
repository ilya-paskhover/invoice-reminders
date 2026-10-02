import type { ReactNode } from "react";

export function EmptyState({ icon, children }: { icon?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-4 py-12 text-center text-sm text-slate-500">
      {icon && <div className="rounded-full bg-slate-100 p-3 text-slate-400">{icon}</div>}
      <p>{children}</p>
    </div>
  );
}
