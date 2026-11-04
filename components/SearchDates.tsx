"use client";

import { useState } from "react";
import DateField from "./DateField";

export default function SearchDates({ from, to }: { from: string; to: string }) {
  const [f, setF] = useState(from);
  const [t, setT] = useState(to);
  return (
    <>
      <input type="hidden" name="from" value={f} />
      <DateField value={f} onChange={setF} placeholder="开始日期" />
      <span className="sf-sep">至</span>
      <input type="hidden" name="to" value={t} />
      <DateField value={t} onChange={setT} placeholder="结束日期" />
    </>
  );
}
