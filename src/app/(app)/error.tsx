"use client";

import { AlertTriangle, RotateCcw } from "lucide-react";
import { useEffect } from "react";
import { Card } from "@/components/ui";

/* Keeps the sidebar and shows a readable message instead of a blank crash page. */
export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => console.error(error), [error]);
  return (
    <Card className="locked">
      <span className="big-icon"><AlertTriangle size={28} /></span>
      <h3>Something went wrong on this page</h3>
      <p className="muted">{error.message || "Unexpected error."}</p>
      <div className="btn-row" style={{ justifyContent: "center" }}>
        <button className="btn" onClick={reset}><RotateCcw size={16} /> Try again</button>
      </div>
    </Card>
  );
}
