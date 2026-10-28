// 必须先加载配置，保证其它模块能读到环境变量
const config = require('./config')
const Koa = require('koa')
const logger = require('./middleware/logger')
const { errorHandler } = require('./middleware/errorHandler')
const rateLimit = require('./middleware/rateLimit')
const router = require('./router')
const db = require('./db')
const { closeSlidingWindow } = require('./utils/rateLimit')

const app = new Koa()

// 信任代理，ctx.ip 才会取 X-Forwarded-For
app.proxy = true

app.use(errorHandler)
app.use(logger)
// 全局限流：默认按 IP，窗口内存实现可在 .env 切换为 redis
app.use(rateLimit())

app.use(router.routes())
app.use(router.allowedMethods())

const server = app.listen(config.port, () => {
  console.log(`server is running at http://localhost:${config.port} (env: ${config.env})`)
})

// 优雅关闭：先停止接收请求，再释放连接池和限流存储
let shuttingDown = false
const shutdown = async signal => {
  if (shuttingDown) return
  shuttingDown = true
  console.log(`[shutdown] 收到 ${signal}，开始关闭`)
  server.close(async () => {
    await Promise.allSettled([db.close(), closeSlidingWindow()])
    console.log('[shutdown] 已完成')
    process.exit(0)
  })
}

process.on('SIGINT', () => shutdown('SIGINT'))
process.on('SIGTERM', () => shutdown('SIGTERM'))

module.exports = app
