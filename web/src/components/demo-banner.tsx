"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api";

const FLAG = "demo-reset-done";

export function DemoBanner() {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (sessionStorage.getItem(FLAG)) {
      sessionStorage.removeItem(FLAG);
      setMessage("Demo data reset.");
    }
  }, []);

  async function reset() {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await apiFetch("/api/demo/reset", { method: "POST" });
      sessionStorage.setItem(FLAG, "1");
      window.location.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Reset failed");
      setBusy(false);
    }
  }

  return (
    <div className="border-b border-amber-200 bg-amber-50 text-amber-900">
      <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-2 text-sm sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p>Demo mode: data resets daily and no real emails are sent.</p>
        <div className="flex flex-wrap items-center gap-3">
          {message && <span role="status" className="font-medium">{message}</span>}
          {error && <span role="alert" className="font-medium text-rose-700">{error}</span>}
          <Button size="sm" variant="secondary" onClick={reset} disabled={busy}>Reset demo data</Button>
        </div>
      </div>
    </div>
  );
}
