"use client";

import { createContext, useContext, type ReactNode } from "react";

type Ctx = { begin: (e: React.PointerEvent, payload: unknown, label: string, tone?: string) => void };

const GhostCtx = createContext<Ctx>({ begin: () => {} });

export function DragGhostProvider({ value, children }: { value: Ctx; children: ReactNode }) {
  return <GhostCtx.Provider value={value}>{children}</GhostCtx.Provider>;
}

export function useDragBegin() {
  return useContext(GhostCtx).begin;
}

export function DragGhostLayer({ ghost }: { ghost: { x: number; y: number; w: number; label: string; tone?: string } | null }) {
  if (!ghost) return null;
  return (
    <div
      className="drag-ghost"
      style={{
        left: ghost.x + 14,
        top: ghost.y + 10,
        minWidth: Math.min(ghost.w, 260),
        borderLeftColor: ghost.tone ?? "var(--acc)",
      }}
    >
      <span className="dg-dot" style={{ background: ghost.tone ?? "var(--acc)" }} />
      {ghost.label}
    </div>
  );
}
