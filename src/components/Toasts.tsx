"use client";

import { CheckCircle2, Info, XCircle } from "lucide-react";
import { createContext, useCallback, useContext, useState, type ReactNode } from "react";

type Kind = "ok" | "bad" | "info";
type Toast = { id: number; msg: string; kind: Kind };

const Ctx = createContext<(msg: string, kind?: Kind) => void>(() => {});

export const useToast = () => useContext(Ctx);

const ICON = { ok: CheckCircle2, bad: XCircle, info: Info };

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const push = useCallback((msg: string, kind: Kind = "info") => {
    const id = Date.now() + Math.random();
    setItems((t) => [...t, { id, msg, kind }]);
    setTimeout(() => setItems((t) => t.filter((x) => x.id !== id)), 4000);
  }, []);

  return (
    <Ctx.Provider value={push}>
      {children}
      <div className="toasts" aria-live="polite">
        {items.map((t) => {
          const Icon = ICON[t.kind];
          return (
            <p key={t.id} className={`toast ${t.kind}`}>
              <Icon size={18} />
              {t.msg}
            </p>
          );
        })}
      </div>
    </Ctx.Provider>
  );
}
