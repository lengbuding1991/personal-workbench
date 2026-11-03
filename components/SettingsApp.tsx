"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Download, Check, Upload } from "lucide-react";
import TopBar from "./TopBar";
import { useConfirm } from "./Confirm";

export default function SettingsApp({
  initial,
}: {
  initial: {
    user_name: string;
    ai_base_url: string;
    ai_model: string;
    ai_key_set: boolean;
    stats: { tasks: number; done: number; notes: number; events: number; reviews: number };
  };
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const [name, setName] = useState(initial.user_name);
  const [base, setBase] = useState(initial.ai_base_url);
  const [model, setModel] = useState(initial.ai_model);
  const [key, setKey] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [testing, setTesting] = useState(false);
  const [testMsg, setTestMsg] = useState("");
  const [importing, setImporting] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [curPw, setCurPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [pwBusy, setPwBusy] = useState(false);
  const [pwMsg, setPwMsg] = useState("");

  const changePw = async () => {
    if (newPw.length < 6) return setPwMsg("新密码至少 6 位");
    setPwBusy(true);
    setPwMsg("");
    try {
      const res = await fetch("/api/auth", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ current: curPw, password: newPw }),
      });
      const d = await res.json().catch(() => ({}));
      if (res.ok) {
        setPwMsg("已更新，这台设备不用重新登录");
        setCurPw("");
        setNewPw("");
      } else {
        setPwMsg(d.error || "修改失败");
      }
    } finally {
      setPwBusy(false);
    }
  };

  const save = async () => {
    setSaving(true);
    setMsg("");
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_name: name, ai_base_url: base, ai_model: model, ...(key ? { ai_key: key } : {}) }),
      });
      if (res.ok) {
        setMsg("已保存");
        setKey("");
        router.refresh();
      } else {
        const d = await res.json().catch(() => ({}));
        setMsg(d.error || "保存失败");
      }
    } finally {
      setSaving(false);
    }
  };

  const testAi = async () => {
    setTesting(true);
    setTestMsg("");
    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "test" }),
      });
      const d = await res.json();
      setTestMsg(res.ok ? `连接成功${d.models?.length ? "：" + d.models.join(", ") : ""}` : d.error || "连接失败");
    } catch {
      setTestMsg("网络异常");
    } finally {
      setTesting(false);
    }
  };


  const clearAll = async () => {
    const ok = await confirm({
      title: "清空全部数据？",
      desc: "所有任务、日程、记录和复盘都会被删除，这个操作不可撤销。建议先导出一份备份。",
      confirmText: "确认清空",
      requireText: "清空",
      danger: true,
    });
    if (!ok) return;
    setClearing(true);
    try {
      const res = await fetch("/api/reset", { method: "POST" });
      if (!res.ok) throw new Error("清空失败");
      setMsg("已清空，可以从零开始");
      router.refresh();
    } catch {
      setMsg("清空失败，请重试");
    } finally {
      setClearing(false);
    }
  };

  const importFile = async (file: File) => {
    setImporting(true);
    setMsg("");
    try {
      const text = await file.text();
      const res = await fetch("/api/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: text,
      });
      const d = await res.json();
      if (res.ok) {
        setMsg(`已导入 ${d.imported} 条`);
        router.refresh();
      } else setMsg(d.error || "导入失败");
    } finally {
      setImporting(false);
    }
  };

  return (
    <>
      <TopBar crumb="设置">
        <button className="primary" onClick={save} disabled={saving}>{saving ? "保存中…" : "保存设置"}</button>
      </TopBar>
      <div className="page-head">
        <div>
          <div className="eyebrow">SETTINGS · 偏好设置</div>
          <h1>这里是你的工作台。</h1>
          <p>所有数据存在本机 SQLite，随时可以导出带走。</p>
        </div>
      </div>

      <div className="settings-grid">
        <section className="card set-card">
          <h2>基本</h2>
          <p className="sub">只影响界面称呼。</p>
          <div className="form">
            <label>你的名字<input value={name} onChange={(e) => setName(e.target.value)} placeholder="Hina" /></label>
          </div>

          <h2 style={{ marginTop: 20 }}>AI 服务</h2>
          <p className="sub">OpenAI 兼容接口，默认 DeepSeek。Key 只存在本地数据库。</p>
          <div className="form">
            <label>Base URL<input value={base} onChange={(e) => setBase(e.target.value)} placeholder="https://api.deepseek.com" /></label>
            <label>模型<input value={model} onChange={(e) => setModel(e.target.value)} placeholder="deepseek-chat" /></label>
            <label>
              API Key
              <input
                type="password"
                value={key}
                onChange={(e) => setKey(e.target.value.trim())}
                placeholder={initial.ai_key_set ? "已配置，留空则不修改" : "sk-…"}
              />
            </label>
            {key.length > 0 && !key.startsWith("sk-") && (
              <p className="notice" style={{ margin: "-4px 0 0", color: "#98763F", background: "#FDF8EC", borderColor: "#F3E6C8" }}>
                DeepSeek 的 Key 以 <b style={{ fontFamily: "var(--mono)" }}>sk-</b> 开头。你现在这串不像 Key（可能是账号 ID 或复制漏了前缀）。
              </p>
            )}
          </div>
          <p className="notice">
            {initial.ai_key_set ? "已检测到本地 Key。" : "尚未配置 Key，AI 拆任务与复盘起稿不可用。"}
            <br />也可以把 Base URL 换成本地 Ollama（如 http://127.0.0.1:11434/v1），模型填 ollama 的模型名。
          </p>

          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
            <button className="b1" onClick={save} disabled={saving}>{saving ? "保存中…" : "保存设置"}</button>
            <button className="b2" onClick={testAi} disabled={testing}>{testing ? "测试中…" : "测试连接"}</button>
            {testMsg && <span className="hint2" style={{ color: testMsg.startsWith("连接成功") ? "#2E8C77" : "#D2795C" }}>{testMsg}</span>}
            {msg && <span className="hint2" style={{ color: msg.includes("失败") ? "#D2795C" : "#2E8C77" }}>{msg.includes("已保存") && <Check size={10} style={{ verticalAlign: -1 }} />} {msg}</span>}
          </div>

          <h2 style={{ marginTop: 20 }}>登录密码</h2>
          <p className="sub">别人打开这个地址时要先输密码。改完这台设备会自动续上，不用重新登录。</p>
          <div className="form">
            <label>当前密码<input type="password" value={curPw} onChange={(e) => setCurPw(e.target.value)} placeholder="现在的密码" /></label>
            <label>新密码<input type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} placeholder="至少 6 位" /></label>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
            <button className="b2" onClick={changePw} disabled={pwBusy}>{pwBusy ? "改中…" : "修改密码"}</button>
            {pwMsg && <span className="hint2" style={{ color: pwMsg.includes("失败") || pwMsg.includes("不对") || pwMsg.includes("至少") ? "#D2795C" : "#2E8C77" }}>{pwMsg}</span>}
          </div>

          <div style={{ marginTop: "auto", paddingTop: 20 }}>
            <h2>顺手用的小技巧</h2>
            <p className="sub">不用记，用两次就成肌肉记忆。</p>
            <div className="set-keys">
              <div><kbd>⌘</kbd><kbd>K</kbd><span>搜索任务、记录、日程</span></div>
              <div><kbd>c</kbd><span>在任何页面随手记一句</span></div>
              <div><kbd>拖动</kbd><span>卡片拖到别的列就改状态</span></div>
              <div><kbd>点空白</kbd><span>日历上点一下就能排日程</span></div>
            </div>
          </div>
        </section>

        <section className="card set-card">
          <h2>数据</h2>
          <p className="sub">数据目录：本机 data/workbench.db</p>
          <div className="form">
            <Link href="/api/export" className="b1" style={{ textAlign: "center", textDecoration: "none" }}>
              <Download size={12} style={{ verticalAlign: -2, marginRight: 4 }} />导出全部数据（JSON）
            </Link>
            <label className="b2" style={{ textAlign: "center", cursor: "pointer", display: "block" }}>
              <Upload size={12} style={{ verticalAlign: -2, marginRight: 4 }} />{importing ? "导入中…" : "导入 JSON 备份"}
              <input type="file" accept="application/json,.json" style={{ display: "none" }} onChange={(e) => { const f = e.target.files?.[0]; if (f) importFile(f); e.target.value = ""; }} />
            </label>
          </div>
          <p className="notice">
            导出包含任务、日程、记录、复盘与外部引用；不含 AI Key。<br /><br />
            V1 不做云同步。以后部署到服务器时，把 data 目录一起带走即可。
          </p>

          <div style={{ marginTop: 14, borderTop: "1px dashed var(--line)", paddingTop: 14 }}>
            <p className="sub" style={{ marginBottom: 8 }}>清空示例数据 / 从零开始（保留设置与 AI Key）</p>
            <button className="b2" onClick={clearAll} disabled={clearing} style={{ color: "#D2795C", borderColor: "#EFC9BA" }}>
              {clearing ? "清空中…" : "清空全部数据"}
            </button>
          </div>

          <h2 style={{ marginTop: 20 }}>你积累了多少</h2>
          <p className="sub">全部存在本机，不会上传。</p>
          <div className="set-stats">
            <div><span>任务</span><b>{initial.stats.tasks}</b><em>已完成 {initial.stats.done}</em></div>
            <div><span>记录</span><b>{initial.stats.notes}</b><em>灵感与素材</em></div>
            <div><span>日程</span><b>{initial.stats.events}</b><em>排过的时间</em></div>
            <div><span>复盘</span><b>{initial.stats.reviews}</b><em>回头看过的</em></div>
          </div>

          <h2 style={{ paddingTop: 16 }}>关于</h2>
          <p className="notice">
            个人工作台 V1 · 本地优先 · 清透蓝绿视觉<br />
            Next.js + SQLite + 原生 node:sqlite · 无第三方云依赖
          </p>
        </section>
      </div>
    </>
  );
}
