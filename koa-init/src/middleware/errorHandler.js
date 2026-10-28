const { fail } = require('../utils/response')

// 自定义业务错误类
class BusinessError extends Error {
  constructor(msg, code = 400) {
    super(msg)
    this.code = code
    this.isBusiness = true
  }
}

const errorHandler = async (ctx, next) => {
  try {
    await next()
    // 404 兜底
    if (ctx.status === 404 && !ctx.body) {
      ctx.body = fail('接口不存在', 404)
    }
  } catch (err) {
    console.error('[全局异常]', err)
    // 业务主动抛出的错误，返回给前端
    if (err instanceof BusinessError) {
      ctx.status = 200
      ctx.body = fail(err.message, err.code)
    } else {
      // 系统未知异常，生产环境隐藏堆栈
      ctx.status = 500
      ctx.body = fail('服务器内部错误', 500)
    }
  }
}

// 兜底：游离Promise异常（抓裸Promise.reject，防止进程崩溃）
process.on('unhandledRejection', (reason, promise) => {
  console.error('[未捕获Promise异常]', reason.message || reason)
})
process.on('uncaughtException', err => {
  console.error('[未捕获同步异常]', err)
  // 生产建议：记录日志后优雅退出，防止进程状态错乱
  
})

module.exports = { errorHandler, BusinessError }
