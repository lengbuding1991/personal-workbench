/**
 * 路由切换时的骨架屏。
 *
 * 为什么需要它：所有页面都是 `force-dynamic`（每次请求都要读 SQLite 现拼 HTML），
 * 经 CF 隧道回源到家里 NAS 的 ttfb 大约 0.8–1.1 秒。没有这个文件的话，点侧栏
 * 之后界面会「原地不动」一秒多，然后整页换掉——主观上就是「很卡」。
 * 有了它，点击立刻出现骨架，数据到了再替换，感觉是「秒开」。
 *
 * 这里不猜每个页面的具体布局，只用通用的卡片骨架：
 * 标题条 + 一排 KPI 胶囊 + 两块内容区，任何页面切进来都不会显得突兀。
 */
export default function AppLoading() {
  return (
    <div className="skel-page" aria-busy="true" aria-live="polite">
      <div className="skel-head">
        <div>
          <div className="skel-bar w-160 h-26" />
          <div className="skel-bar w-220 h-11" style={{ marginTop: 10 }} />
        </div>
        <div className="skel-bar w-96 h-32" style={{ marginLeft: "auto" }} />
      </div>

      <div className="skel-kpis">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="skel-pill">
            <div className="skel-bar w-72 h-9" />
            <div className="skel-bar w-48 h-9" style={{ marginTop: 8 }} />
          </div>
        ))}
      </div>

      <div className="skel-grid">
        <div className="skel-card">
          <div className="skel-bar w-120 h-12" />
          <div className="skel-bar w-full h-120" style={{ marginTop: 14 }} />
        </div>
        <div className="skel-card">
          <div className="skel-bar w-100 h-12" />
          <div className="skel-lines">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="skel-bar h-34" style={{ width: `${92 - i * 7}%` }} />
            ))}
          </div>
        </div>
        <div className="skel-card">
          <div className="skel-bar w-100 h-12" />
          <div className="skel-lines">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="skel-bar h-34" style={{ width: `${88 - i * 9}%` }} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
