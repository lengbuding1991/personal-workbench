"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { AlertTriangle, Trash2, X } from "lucide-react";
import { uiLock } from "@/lib/ui-lock";

export type ConfirmOptions = {
  title: string;
  desc?: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
  /** 需要用户原样输入这段文字才能确认，用于不可撤销操作 */
  requireText?: string;
};

type Pending = ConfirmOptions & { resolve: (ok: boolean) => void };

const Ctx = createContext<(o: ConfirmOptions) => Promise<boolean>>(() => Promise.resolve(false));

export function useConfirm() {
  return useContext(Ctx);
}

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [req, setReq] = useState<Pending | null>(null);
  const [typed, setTyped] = useState("");
  const okRef = useRef<HTMLButtonElement | null>(null);
  const cancelRef = useRef<HTMLButtonElement | null>(null);

  const ask = useCallback(
    (o: ConfirmOptions) =>
      new Promise<boolean>((resolve) => {
        setTyped("");
        setReq({ ...o, resolve });
      }),
    [],
  );

  const close = useCallback(
    (ok: boolean) => {
      setReq((cur) => {
        cur?.resolve(ok);
        return null;
      });
      setTyped("");
    },
    [],
  );

  useEffect(() => {
    if (!req) return;
    uiLock.modal += 1;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close(false);
      }
    };
    window.addEventListener("keydown", onKey);
    const t = window.setTimeout(() => (req.danger ? cancelRef.current : okRef.current)?.focus(), 60);
    return () => {
      document.body.style.overflow = prev;
      uiLock.modal = Math.max(0, uiLock.modal - 1);
      window.removeEventListener("keydown", onKey);
      window.clearTimeout(t);
    };
  }, [req, typed, close]);

  const blocked = Boolean(req?.requireText) && typed !== req?.requireText;

  return (
    <Ctx.Provider value={ask}>
      {children}
      {req && (
        <div className="cf-overlay" onMouseDown={() => close(false)}>
          <div
            className="cf"
            role="dialog"
            aria-modal="true"
            aria-labelledby="cf-title"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <button className="cf-x" onClick={() => close(false)} aria-label="关闭">
              <X size={15} />
            </button>

            <div className={`cf-ico ${req.danger ? "danger" : ""}`}>
              {req.danger ? <Trash2 size={18} /> : <AlertTriangle size={18} />}
            </div>

            <h3 id="cf-title" className="cf-title">{req.title}</h3>
            {req.desc && <p className="cf-desc">{req.desc}</p>}

            {req.requireText && (
              <label className="cf-typed">
                <span>
                  输入 <b>{req.requireText}</b> 继续
                </span>
                <input
                  value={typed}
                  onChange={(e) => setTyped(e.target.value)}
                  placeholder={req.requireText}
                  autoComplete="off"
                  spellCheck={false}
                />
              </label>
            )}

            <div className="cf-acts">
              <button ref={cancelRef} className="cf-cancel" onClick={() => close(false)}>
                {req.cancelText || "取消"}
              </button>
              <button
                ref={okRef}
                className={`cf-ok ${req.danger ? "danger" : ""}`}
                onClick={() => close(true)}
                disabled={blocked}
              >
                {req.confirmText || (req.danger ? "删除" : "确定")}
              </button>
            </div>
          </div>
        </div>
      )}
    </Ctx.Provider>
  );
}
