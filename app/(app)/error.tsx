"use client";

import { useEffect } from "react";
import { AlertTriangle, RotateCw, Home } from "lucide-react";

/**
 * 路由级错误边界。
 *
 * 之前项目里没有任何 error.tsx：任何一个页面组件抛错（比如日期解析失败、
 * 数据里出现 null），用户看到的就是整片白屏，连侧栏都没了，只能手动改地址。
 * 有了这个文件，出错时至少留住外壳，并给出「重试 / 回首页」两条出路。
 */
export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[workbench] 页面渲染出错：", error);
  }, [error]);

  return (
    <div className="err-page">
      <div className="err-card">
        <div className="err-icon">
          <AlertTriangle size={22} />
        </div>
        <h1>这一页出了点问题</h1>
        <p>你的数据都还在，只是这一页没能正常显示出来。</p>
        {error.digest ? <code className="err-code">错误编号 {error.digest}</code> : null}
        <div className="err-acts">
          <button className="b1" onClick={reset}>
            <RotateCw size={14} /> 重试
          </button>
          <a className="b2" href="/">
            <Home size={14} /> 回首页
          </a>
        </div>
      </div>
    </div>
  );
}
