import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb, nowIso } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { advance } from "@/lib/repeat";
import { format, parseISO } from "date-fns";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Patch = z.object({
  title: z.string().min(1).max(300).optional(),
  note: z.string().max(4000).optional(),
  status: z.enum(["todo", "doing", "done"]).optional(),
  priority: z.enum(["high", "med", "low"]).optional(),
  area: z.enum(["work", "side", "media", "study", "life"]).optional(),
  due_date: z.string().nullable().optional(),
  scheduled_start: z.string().nullable().optional(),
  scheduled_end: z.string().nullable().optional(),
  estimate_min: z.number().int().nullable().optional(),
  project: z.string().max(80).optional(),
  project_id: z.number().int().positive().nullable().optional(),
  tags: z.string().max(300).optional(),
  sort: z.number().int().optional(),
  repeat_rule: z.enum(["none", "daily", "weekdays", "weekly", "monthly"]).optional(),
  remind_min: z.number().int().min(0).max(10080).nullable().optional(),
});

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const gate = await requireAuth();
  if (gate) return gate;
  const { id } = await ctx.params;
  const n = Number(id);
  if (!Number.isFinite(n)) return NextResponse.json({ error: "bad id" }, { status: 400 });
  const body = await req.json();
  const parsed = Patch.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "参数不合法" }, { status: 400 });
  const db = getDb();
  const before = db.prepare("SELECT * FROM task WHERE id=?").get(n) as Record<string, unknown> | undefined;
  if (!before) return NextResponse.json({ error: "not found" }, { status: 404 });

  const fields: string[] = [];
  const args: unknown[] = [];
  for (const [k, v] of Object.entries(parsed.data)) {
    fields.push(`${k} = ?`);
    args.push(v);
  }
  if (parsed.data.status) {
    fields.push("done_at = ?");
    args.push(parsed.data.status === "done" ? nowIso() : null);
  }
  if (!fields.length) return NextResponse.json({ ok: true });
  fields.push("updated_at = ?");
  args.push(nowIso());
  args.push(n);
  db.prepare(`UPDATE task SET ${fields.join(", ")} WHERE id = ?`).run(...(args as (string | number | null)[]));
  const task = db.prepare("SELECT * FROM task WHERE id=?").get(n) as Record<string, unknown> | undefined;

  /*
   * 重复任务：勾完这一条，就把下一次排出来。
   *
   * 为什么在这里生成而不是「列表里虚拟展开」：任务有「完成」状态，
   * 虚拟展开会让同一件事在待办里出现十几次，反而看不出哪条是真的。
   * 所以做法是：原来那条留着当历史，另存一条新的待办。
   */
  let next = null;
  const becameDone = parsed.data.status === "done" && before.status !== "done";
  if (becameDone && task && task.repeat_rule && task.repeat_rule !== "none") {
    const anchor = String(task.due_date || task.scheduled_start || "").slice(0, 10);
    if (anchor) {
      try {
        const nextDate = advance(parseISO(anchor), String(task.repeat_rule));
        const nd = format(nextDate, "yyyy-MM-dd");
        // 原来的安排时间也跟着往后挪同样的天数
        let nStart: string | null = null;
        let nEnd: string | null = null;
        if (task.scheduled_start) {
          const s = parseISO(String(task.scheduled_start));
          const shift = nextDate.getTime() - parseISO(anchor).getTime();
          nStart = format(new Date(s.getTime() + shift), "yyyy-MM-dd'T'HH:mm");
        }
        if (task.scheduled_end) {
          const e = parseISO(String(task.scheduled_end));
          const shift = nextDate.getTime() - parseISO(anchor).getTime();
          nEnd = format(new Date(e.getTime() + shift), "yyyy-MM-dd'T'HH:mm");
        }
        const info = db
          .prepare(
            `INSERT INTO task (title,note,status,priority,area,due_date,scheduled_start,scheduled_end,estimate_min,project,project_id,tags,repeat_rule,remind_min,done_at,sort,created_at,updated_at)
             VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,NULL,?,?,?)`
          )
          .run(
            String(task.title),
            String(task.note ?? ""),
            "todo",
            String(task.priority ?? "med"),
            String(task.area ?? "work"),
            nd,
            nStart,
            nEnd,
            task.estimate_min as number | null,
            String(task.project ?? ""),
            task.project_id as number | null,
            String(task.tags ?? ""),
            String(task.repeat_rule),
            task.remind_min as number | null,
            task.sort as number,
            nowIso(),
            nowIso()
          );
        next = db.prepare("SELECT * FROM task WHERE id=?").get(Number(info.lastInsertRowid));
      } catch {
        /* 日期异常就不生成了，至少这次更新是成功的 */
      }
    }
  }

  return NextResponse.json({ task, next });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const gate = await requireAuth();
  if (gate) return gate;
  const { id } = await ctx.params;
  const n = Number(id);
  getDb().prepare("DELETE FROM task WHERE id=?").run(n);
  return NextResponse.json({ ok: true });
}
