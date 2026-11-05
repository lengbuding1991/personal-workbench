"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Download, Check, Upload, RefreshCw, Database } from "lucide-react";
import TopBar from "./TopBar";
import { useConfirm } from "./Confirm";
import { api, errText } from "@/lib/api";

export default function SettingsApp({
  initial,
}: {
  initial: {
    user_name: string;
    ai_base_url: string;
    ai_model: string;
    ai_key_set: boolean;
    stats: { tasks: number; done: number; notes: number; events: number; reviews: number };
    version: string;
    built: string;
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
  const [updating, setUpdating] = useState(false);
  const [updMsg, setUpdMsg] = useState("");
  /* 点完「立即更新」后轮询 /api/health，用真实的版本号变化给出反馈。
     为什么必须轮询：watchtower 拉完镜像会重建容器，这个页面会先断连；
     光说「已触发」用户根本不知道到底成没成。 */
  const [built, setBuilt] = useState(initial.built);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const changePw = async () => {
    if (newPw.length < 6) return setPwMsg("新密码至少 6 位");
    setPwBusy(true);
    setPwMsg("");
    try {
      await api("/api/auth", { method: "PATCH", body: { current: curPw, password: newPw } });
      setPwMsg("已更新，这台设备不用重新登录");
      setCurPw("");
      setNewPw("");
    } catch (e) {
      setPwMsg(errText(e, "修改失败"));
    } finally {
      setPwBusy(false);
    }
  };

  const save = async () => {
    setSaving(true);
    setMsg("");
    try {
      await api("/api/settings", {
        method: "PATCH",
        body: { user_name: name, ai_base_url: base, ai_model: model, ...(key ? { ai_key: key } : {}) },
      });
      setMsg("已保存");
      setKey("");
      router.refresh();
    } catch (e) {
      setMsg(errText(e, "保存失败"));
    } finally {
      setSaving(false);
    }
  };

  const testAi = async () => {
    setTesting(true);
    setTestMsg("");
    try {
      const d = await api<{ models?: string[] }>("/api/ai", { method: "POST", body: { action: "test" } });
      setTestMsg(`连接成功${d.models?.length ? "：" + d.models.join(", ") : ""}`);
    } catch (e) {
      setTestMsg(errText(e, "网络异常"));
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
      await api("/api/reset", { method: "POST" });
      setMsg("已清空，可以从零开始");
      router.refresh();
    } catch (e) {
      setMsg(errText(e, "清空失败，请重试"));
    } finally {
      setClearing(false);
    }
  };

  const importFile = async (file: File) => {
    setImporting(true);
    setMsg("");
    try {
      const text = await file.text();
      const d = await api<{ imported: number }>("/api/import", { method: "POST", body: JSON.parse(text) });
      setMsg(`已导入 ${d.imported} 条`);
      router.refresh();
    } catch (e) {
      setMsg(errText(e, "导入失败"));
    } finally {
      setImporting(false);
    }
  };

  const triggerUpdate = async () => {
    setUpdating(true);
    setUpdMsg("");
    try {
      const d = await api<{ message?: string }>("/api/update", { method: "POST" });
      setUpdMsg(d.message || "已通知 watchtower");
    } catch (e) {
      setUpdMsg(errText(e, "网络异常，没叫动更新"));
      setUpdating(false);
      return;
    }
    setUpdating(false);

    // 开始盯版本号：断连说明容器正在重建，别当失败
    const before = built;
    let tries = 0;
    let dropped = false;
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      tries += 1;
      if (tries > 60) {
        if (pollRef.current) clearInterval(pollRef.current);
        setUpdMsg("等了 3 分钟版本还没变，可能是构建失败或没有新提交");
        return;
      }
      try {
        const r = await fetch("/api/health", { cache: "no-store" });
        if (!r.ok) throw new Error("bad");
        const h = (await r.json()) as { sha?: string; built?: string };
        if (h.built && h.built !== before) {
          if (pollRef.current) clearInterval(pollRef.current);
          setBuilt(h.built);
          setUpdMsg(`已更新到 ${h.built}，刷新页面就是新版`);
          router.refresh();
          return;
        }
        if (dropped) setUpdMsg("容器重建好了，但版本没变（说明没有新提交）");
      } catch {
        dropped = true;
        setUpdMsg("容器正在重建，页面会短暂断开…");
      }
    }, 3000);
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
          <p className="sub">OpenAI 兼容接口。Key 只存在本地数据库，不会上传到别处。</p>

          <div className="ai-presets">
            {[
              { label: "DeepSeek", base: "https://api.deepseek.com", model: "deepseek-chat", free: false },
              { label: "智谱 GLM-4-Flash（免费）", base: "https://open.bigmodel.cn/api/paas/v4", model: "glm-4-flash", free: true },
              { label: "硅基流动", base: "https://api.siliconflow.cn/v1", model: "Qwen/Qwen2.5-7B-Instruct", free: false },
              { label: "OpenRouter", base: "https://openrouter.ai/api/v1", model: "google/gemini-2.0-flash-exp:free", free: false },
            ].map((p) => (
              <button
                key={p.label}
                type="button"
                className={`chip ${base === p.base ? "on" : ""}`}
                onClick={() => {
                  setBase(p.base);
                  setModel(p.model);
                }}
              >
                {p.label}
              </button>
            ))}
          </div>

          <div className="form">
            <label>Base URL<input value={base} onChange={(e) => setBase(e.target.value)} placeholder="https://api.deepseek.com" /></label>
            <label>模型<input value={model} onChange={(e) => setModel(e.target.value)} placeholder="deepseek-chat" /></label>
            <label>
              API Key
              <input
                type="password"
                value={key}
                onChange={(e) => setKey(e.target.value.trim())}
                placeholder={initial.ai_key_set ? "已配置，留空则不修改" : "粘贴你的 Key"}
              />
            </label>
            {key.length > 0 && key.length < 20 && (
              <p className="notice" style={{ margin: "-4px 0 0", color: "#98763F", background: "#FDF8EC", borderColor: "#F3E6C8" }}>
                这串看起来偏短，Key 一般是 30 位以上。检查一下是不是复制漏了。
              </p>
            )}
          </div>
          <p className="notice">
            {initial.ai_key_set ? "已检测到本地 Key。" : "尚未配置 Key，AI 拆任务与复盘起稿不可用。"}
            <br />想先零成本试用，点上面的「智谱 GLM-4-Flash（免费）」，去 bigmodel.cn 注册拿 Key 就行，每月自动恢复额度。
            <br />也可以用本地 Ollama（Base URL 填 http://127.0.0.1:11434/v1）。
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
          <p className="sub">数据库文件 workbench.db，下面的「下载完整数据库」拿到的就是这个文件本身。</p>
          <div className="form">
            <Link href="/api/export-db" className="b1" style={{ textAlign: "center", textDecoration: "none" }}>
              <Database size={12} style={{ verticalAlign: -2, marginRight: 4 }} />下载完整数据库（.db）
            </Link>
            <Link href="/api/export" className="b2" style={{ textAlign: "center", textDecoration: "none" }}>
              <Download size={12} style={{ verticalAlign: -2, marginRight: 4 }} />导出为 JSON（可读，用于迁移）
            </Link>
            <label className="b2" style={{ textAlign: "center", cursor: "pointer", display: "block" }}>
              <Upload size={12} style={{ verticalAlign: -2, marginRight: 4 }} />{importing ? "导入中…" : "导入 JSON 备份"}
              <input type="file" accept="application/json,.json" style={{ display: "none" }} onChange={(e) => { const f = e.target.files?.[0]; if (f) importFile(f); e.target.value = ""; }} />
            </label>
          </div>

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

          <h2 style={{ marginTop: 20 }}>更新工作台</h2>
          <p className="sub">平时每 24 小时自动查一次，想立刻用新版就点下面。</p>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
            <button className="b1" onClick={triggerUpdate} disabled={updating}>
              <RefreshCw size={13} style={{ verticalAlign: -2, marginRight: 5 }} />
              {updating ? "触发中…" : "立即更新"}
            </button>
            {updMsg && <span className="hint2" style={{ color: updMsg.includes("失败") || updMsg.includes("没叫") || updMsg.includes("缺少") ? "#D2795C" : "#2E8C77" }}>{updMsg}</span>}
          </div>
          <p className="notice" style={{ marginTop: 10 }}>
            当前版本：<b style={{ fontFamily: "var(--mono)", fontSize: 12 }}>{built || initial.version.slice(0, 7)}</b>
            <br />点「立即更新」后，watchtower 会去拉最新镜像并重建容器，约 30 秒生效；
            生效后这个页面会自动刷新成新版本日期。构建失败或没新提交时，版本日期保持不变。
          </p>
        </section>
      </div>
    </>
  );
}
