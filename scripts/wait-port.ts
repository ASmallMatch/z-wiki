// wait-port.ts — 等待 TCP 端口就绪后退出
// 用于 dev 编排:web(vite) 等 server(fastify) 起来再启动,消除 vite 代理 ECONNREFUSED 启动噪音
// 用法: tsx scripts/wait-port.ts 3000
import net from 'node:net'

const port = Number(process.argv[2] ?? 3000)
const HOST = '127.0.0.1'
const INTERVAL_MS = 200
const TIMEOUT_MS = 30_000

const deadline = Date.now() + TIMEOUT_MS

function tryConnect(): void {
  const sock = net.createConnection({ port, host: HOST })
  sock.once('connect', () => {
    sock.destroy()
    process.exit(0)
  })
  sock.once('error', () => {
    sock.destroy()
    if (Date.now() > deadline) {
      console.error(
        `wait-port: ${HOST}:${port} 在 ${TIMEOUT_MS / 1000}s 内未就绪,放弃等待(继续启动 web)`,
      )
      process.exit(0)
    }
    setTimeout(tryConnect, INTERVAL_MS)
  })
}

tryConnect()
