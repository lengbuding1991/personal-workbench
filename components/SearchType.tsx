"use client";

import { useState } from "react";
import Select from "./Select";

/**
 * 搜索页的类型筛选。
 *
 * 搜索页是服务端表单（`<form action="/search">`），不是客户端状态，
 * 所以自己维护一份 state，同时用 hidden input 把值带进提交。
 * 这样既能用自绘下拉，又不破坏「回车即搜」的体验。
 */
export default function SearchType({ value }: { value: string }) {
  const [v, setV] = useState(value);
  return (
    <>
      <input type="hidden" name="type" value={v} />
      <Select
        ariaLabel="内容类型"
        value={v}
        onChange={setV}
        options={[
          { value: "all", label: "全部类型" },
          { value: "task", label: "任务" },
          { value: "note", label: "记录" },
          { value: "event", label: "日程" },
          { value: "review", label: "复盘" },
        ]}
      />
    </>
  );
}
