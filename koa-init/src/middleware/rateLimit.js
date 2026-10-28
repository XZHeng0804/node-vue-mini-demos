const config = require('../config')
const { fail } = require('../utils/response')
const { getSlidingWindow } = require('../utils/rateLimit')

/**
 * 滑动窗口限流中间件
 * @param {object} [options]
 * @param {number} [options.limit] 窗口内最大请求数
 * @param {number} [options.windowMs] 窗口长度（毫秒）
 * @param {(ctx) => string} [options.keyGenerator] 限流维度，默认按 IP
 * @param {{acquire: Function}} [options.store] 自定义存储，默认取全局实例
 */
const rateLimit = (options = {}) => {
  const limit = options.limit ?? config.rateLimit.limit
  const windowMs = options.windowMs ?? config.rateLimit.windowMs
  const keyGenerator = options.keyGenerator || (ctx => ctx.ip)
  const store = options.store || getSlidingWindow()

  return async (ctx, next) => {
    const { allowed, remaining, resetAt, retryAfter } = await store.acquire(keyGenerator(ctx), limit, windowMs)

    ctx.set('X-RateLimit-Limit', String(limit))
    ctx.set('X-RateLimit-Remaining', String(remaining))
    ctx.set('X-RateLimit-Reset', String(Math.ceil(resetAt / 1000)))

    if (!allowed) {
      ctx.set('Retry-After', String(Math.ceil(retryAfter / 1000)))
      ctx.status = 429
      ctx.body = fail('请求过于频繁，请稍后再试', 429)
      return
    }

    await next()
  }
}

module.exports = rateLimit
