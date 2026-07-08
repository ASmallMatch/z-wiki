// About.tsx - 关于页:开源许可声明(ADR-0007 决策 4:GPL-2.0 分发义务)。
// pandoc 作为独立二进制被 spawn(不链接进 z-wiki 进程),GPL 不传染主程序代码。
// 分发义务 = 保留许可声明 + 提供源码获取方式(jgm/pandoc 源码链接)。
import { Link } from 'react-router-dom'

export default function About() {
  return (
    <div className="about-page">
      <h1>关于 z-wiki</h1>
      <section className="about-section">
        <h2>开源许可</h2>
        <p>
          z-wiki 内置{' '}
          <a href="https://github.com/jgm/pandoc" target="_blank" rel="noopener noreferrer">
            pandoc
          </a>{' '}
          二进制用于文档格式转换(非 md 上传解析),遵循{' '}
          <a
            href="https://www.gnu.org/licenses/old-licenses/gpl-2.0.html"
            target="_blank"
            rel="noopener noreferrer"
          >
            GPL-2.0
          </a>{' '}
          许可。
        </p>
        <p>
          pandoc 作为独立可执行文件被调用,不链接进 z-wiki 进程,GPL 不传染主程序代码。 pandoc
          源码获取:
          <a href="https://github.com/jgm/pandoc" target="_blank" rel="noopener noreferrer">
            github.com/jgm/pandoc
          </a>
          。
        </p>
      </section>
      <Link to="/" className="about-back">
        ← 返回首页
      </Link>
    </div>
  )
}
