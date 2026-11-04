"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Task, TaskStatus } from "@/lib/db";
import { useToast } from "@/components/Toast";
import { api, errText } from "@/lib/api";

const UNDO_MS = 6000;

/**
 * 任务列表的本地状态 + 即时反馈。
 * - 勾选、开始、删除都先改本地 state，界面立刻响应，再补网络请求。
 * - 删除延迟 6 秒真正落库，期间可以在 toast 里撤销。
 */
export function useTasks(initial: Task[]) {
  const [tasks, setTasks] = useState<Task[]>(initial);
  const router = useRouter();
  const toast = useToast();
  const timers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => {
    setTasks(initial);
  }, [initial]);

  useEffect(() => {
    const map = timers.current;
    return () => {
      // 卸载时把还没到期的删除直接执行，避免「删了又回来」
      for (const [id, t] of map) {
        clearTimeout(t);
        void api(`/api/tasks/${id}`, { method: "DELETE" }).catch(() => {});
      }
      map.clear();
    };
  }, []);

  const commitStatus = useCallback(
    async (id: number, status: TaskStatus) => {
      try {
        await api(`/api/tasks/${id}`, { method: "PATCH", body: { status } });
      } catch (e) {
        toast(errText(e, "没保存上，刷新一下再试"));
      }
      router.refresh();
    },
    [router, toast]
  );

  const setStatus = useCallback(
    (task: Task, status: TaskStatus) => {
      const prev = task.status;
      setTasks((list) => list.map((t) => (t.id === task.id ? { ...t, status } : t)));
      void commitStatus(task.id, status);
      const label = status === "done" ? "完成" : status === "doing" ? "开始" : "退回待办";
      toast(`「${task.title}」${label}了`, {
        label: "撤销",
        onClick: async () => {
          setTasks((list) => list.map((t) => (t.id === task.id ? { ...t, status: prev } : t)));
          await commitStatus(task.id, prev);
        },
      });
    },
    [commitStatus, toast]
  );

  const cycle = useCallback(
    (task: Task) => {
      setStatus(task, task.status === "done" ? "todo" : "done");
    },
    [setStatus]
  );

  const remove = useCallback(
    (task: Task) => {
      setTasks((list) => list.filter((t) => t.id !== task.id));
      const timer = setTimeout(async () => {
        timers.current.delete(task.id);
        try {
          await api(`/api/tasks/${task.id}`, { method: "DELETE" });
        } catch (e) {
          toast(errText(e, "没删掉，刷新一下再试"));
        }
        router.refresh();
      }, UNDO_MS);
      timers.current.set(task.id, timer);

      toast(`已删除「${task.title}」`, {
        label: "撤销",
        onClick: () => {
          const t = timers.current.get(task.id);
          if (t) clearTimeout(t);
          timers.current.delete(task.id);
          setTasks((list) => (list.some((x) => x.id === task.id) ? list : [...list, task]));
        },
      });
    },
    [router, toast]
  );

  const removeMany = useCallback(
    async (ids: number[]) => {
      if (!ids.length) return;
      setTasks((list) => list.filter((t) => !ids.includes(t.id)));
      await Promise.all(ids.map((id) => fetch(`/api/tasks/${id}`, { method: "DELETE" })));
      toast(`已删除 ${ids.length} 件任务`);
      router.refresh();
    },
    [router, toast]
  );

  const setManyStatus = useCallback(
    async (ids: number[], status: TaskStatus) => {
      if (!ids.length) return;
      setTasks((list) => list.map((t) => (ids.includes(t.id) ? { ...t, status } : t)));
      await Promise.all(
        ids.map((id) =>
          fetch(`/api/tasks/${id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status }),
          })
        )
      );
      toast(`已把 ${ids.length} 件任务标记为${status === "done" ? "完成" : status === "doing" ? "进行中" : "待办"}`);
      router.refresh();
    },
    [router, toast]
  );

  return { tasks, setTasks, setStatus, cycle, remove, removeMany, setManyStatus };
}
