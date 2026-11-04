"use client";

import { Repeat, Bell } from "lucide-react";
import { RULES, ruleLabel } from "@/lib/repeat";

/**
 * 重复规则选择。
 *
 * 抽出来给任务弹窗和日程弹窗共用 —— 两边规则完全一样，
 * 分开写迟早会出现「任务里有『每个工作日』、日程里没有」这种不一致。
 */
export function RepeatField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <label>
      <span className="lf-label">
        <Repeat size={11} style={{ verticalAlign: -1, marginRight: 4 }} />
        重复
      </span>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {RULES.map((r) => (
          <option key={r} value={r}>
            {ruleLabel[r]}
          </option>
        ))}
      </select>
    </label>
  );
}

const remindOptions: { v: string; label: string }[] = [
  { v: "", label: "不提醒" },
  { v: "0", label: "准时提醒" },
  { v: "5", label: "提前 5 分钟" },
  { v: "15", label: "提前 15 分钟" },
  { v: "30", label: "提前 30 分钟" },
  { v: "60", label: "提前 1 小时" },
  { v: "1440", label: "提前 1 天" },
];

/**
 * 提醒时间。值存成「提前多少分钟」的字符串，空串表示不提醒。
 *
 * 为什么用分钟而不是绝对时间：任务改期、日程拖到别的时间段之后，
 * 「提前 15 分钟」这个意图依然成立，不用跟着改。
 */
export function RemindField({
  value,
  onChange,
}: {
  value: number | null | undefined;
  onChange: (v: number | null) => void;
}) {
  return (
    <label>
      <span className="lf-label">
        <Bell size={11} style={{ verticalAlign: -1, marginRight: 4 }} />
        提醒
      </span>
      <select
        value={value === null || value === undefined ? "" : String(value)}
        onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
      >
        {remindOptions.map((o) => (
          <option key={o.v} value={o.v}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
