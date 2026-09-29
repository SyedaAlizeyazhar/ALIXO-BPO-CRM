"use client";

import { Eye, EyeOff, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ADMIN_PORTAL } from "@/lib/config";

/* Hidden admin entrance: password only. */
export default function AdminLoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/auth/admin-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Login failed");
      router.replace(ADMIN_PORTAL);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="auth-fields">
      <span className="big-icon"><ShieldCheck size={28} /></span>
      <h2>Admin access</h2>
      <p className="muted">Enter the admin password to manage agents, callbacks and the sheet.</p>
      <label className="inp">
        Admin password
        <span className="pw">
          <input type={show ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" autoFocus required />
          <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? "Hide password" : "Show password"}>
            {show ? <EyeOff size={17} /> : <Eye size={17} />}
          </button>
        </span>
      </label>
      {error && <p className="form-msg bad">{error}</p>}
      <button className="btn full" disabled={busy}>
        <ShieldCheck size={18} /> {busy ? "Checking…" : "Enter admin portal"}
      </button>
    </form>
  );
}
