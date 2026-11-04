import Link from "next/link";
import { Compass, Home } from "lucide-react";

/**
 * 404 页面。
 *
 * 之前没有 not-found.tsx，访问不存在的地址会落到 Next 默认的英文页，
 * 和工作台的中文界面完全不搭，而且没有回首页的入口。
 */
export default function NotFound() {
  return (
    <div className="err-page">
      <div className="err-card">
        <div className="err-icon nf">
          <Compass size={22} />
        </div>
        <h1>这个地址不存在</h1>
        <p>可能是链接过期了，或者地址里拼错了一个字。</p>
        <div className="err-acts">
          <Link className="b1" href="/">
            <Home size={14} /> 回首页
          </Link>
          <Link className="b2" href="/search">
            全局搜索
          </Link>
        </div>
      </div>
    </div>
  );
}
