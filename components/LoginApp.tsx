"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, LogIn, ShieldCheck, Sparkles } from "lucide-react";

/**
 * 登录页。
 * hasPassword=false 是首次使用：设置密码（输两遍）。
 * hasPassword=true 是日常登录：输一次。
 */
export default function LoginApp({ hasPassword, next }: { hasPassword: boolean; next: string }) {
  const router = useRouter();
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [shake, setShake] = useState(false);
  const [step, setStep] = useState<"in" | "done">("in");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setErr("");

    if (!hasPassword) {
      if (pw.length < 6) return setErr("密码至少 6 位");
      if (pw !== pw2) return setErr("两次输入不一致");
    }

    setBusy(true);
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(hasPassword ? { password: pw } : { password: pw, confirm: pw2 }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(data.error ?? "登录失败，再试一次");
        setShake(true);
        setTimeout(() => setShake(false), 420);
        setBusy(false);
        return;
      }
      setStep("done");
      // 稍等一下让「进去了」这个反馈被看到，再跳转
      setTimeout(() => {
        router.replace(next || "/");
        router.refresh();
      }, 380);
    } catch {
      setErr("网络不对，检查一下再试");
      setBusy(false);
    }
  };

  return (
    <div className="login-wrap">
      <div className="blobs" aria-hidden>
        <i className="b1" />
        <i className="b2" />
        <i className="b3" />
      </div>

      <div className={`login-card ${shake ? "shake" : ""}`}>
        <div className="login-brand">
          <div className="logo">
            <svg width="19" height="19" viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <rect x="1" y="1" width="10" height="6" rx="3" fill="#fff" opacity=".95" />
              <rect x="1" y="9" width="6" height="10" rx="3" fill="#fff" opacity=".8" />
              <rect x="9" y="9" width="10" height="10" rx="5" fill="#fff" opacity=".55" />
            </svg>
          </div>
          <div>
            <b>个人成长工作台</b>
            <span>GROWTH WORKBENCH</span>
          </div>
        </div>

        {step === "done" ? (
          <div className="login-done">
            <ShieldCheck size={30} />
            <b>进去了</b>
            <span>正在打开你的工作台…</span>
          </div>
        ) : (
          <>
            <h1>{hasPassword ? "欢迎回来" : "先把门锁上"}</h1>
            <p className="login-sub">
              {hasPassword
                ? "输入密码，继续看你的任务、日程和记录。"
                : "这是第一次打开。设一个只有你知道的密码，之后每次进来都要输入。"}
            </p>

            <form onSubmit={submit} noValidate>
              <label className="login-label">密码</label>
              <div className="login-field">
                <input
                  ref={inputRef}
                  type={show ? "text" : "password"}
                  value={pw}
                  autoComplete={hasPassword ? "current-password" : "new-password"}
                  onChange={(e) => setPw(e.target.value)}
                  placeholder={hasPassword ? "输入密码" : "至少 6 位"}
                  aria-label="密码"
                />
                <button
                  type="button"
                  className="login-eye"
                  onClick={() => setShow((s) => !s)}
                  aria-label={show ? "隐藏密码" : "显示密码"}
                >
                  {show ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>

              {!hasPassword && (
                <>
                  <label className="login-label" style={{ marginTop: 12 }}>
                    再输一遍
                  </label>
                  <div className="login-field">
                    <input
                      type={show ? "text" : "password"}
                      value={pw2}
                      autoComplete="new-password"
                      onChange={(e) => setPw2(e.target.value)}
                      placeholder="确认密码"
                      aria-label="确认密码"
                    />
                  </div>
                  <div className="login-note">
                    <Sparkles size={12} />
                    别忘了 —— 这个密码只存在本机的数据库里，没有「找回」按钮。
                  </div>
                </>
              )}

              {err && <div className="login-err">{err}</div>}

              <button type="submit" className="login-submit" disabled={busy || !pw}>
                {busy ? (
                  "等一下…"
                ) : (
                  <>
                    <LogIn size={14} />
                    {hasPassword ? "进去" : "设置并进入"}
                  </>
                )}
              </button>
            </form>

            <div className="login-foot">
              数据都在你自己的电脑上 · <span className="mono">127.0.0.1:3100</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
