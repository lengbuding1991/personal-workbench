"use client";

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";

type ToastAction = { label: string; onClick: () => void | Promise<void> };
type ToastItem = { id: number; msg: string; action?: ToastAction; leaving?: boolean };

const Ctx = createContext<(msg: string, action?: ToastAction) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const seq = useRef(0);

  const drop = useCallback((id: number) => {
    setItems((prev) => prev.map((t) => (t.id === id ? { ...t, leaving: true } : t)));
    setTimeout(() => setItems((prev) => prev.filter((t) => t.id !== id)), 180);
  }, []);

  const push = useCallback(
    (msg: string, action?: ToastAction) => {
      const id = ++seq.current;
      setItems((prev) => [...prev.slice(-2), { id, msg, action }]);
      setTimeout(() => drop(id), 5200);
    },
    [drop]
  );

  return (
    <Ctx.Provider value={push}>
      {children}
      {items.length > 0 && (
        <div className="toasts" role="status" aria-live="polite">
          {items.map((t) => (
            <div className={`toast ${t.leaving ? "out" : ""}`} key={t.id}>
              <span className="toast-msg">{t.msg}</span>
              {t.action && (
                <button
                  className="toast-act"
                  onClick={async () => {
                    drop(t.id);
                    await t.action!.onClick();
                  }}
                >
                  {t.action.label}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </Ctx.Provider>
  );
}

export const useToast = () => useContext(Ctx);
