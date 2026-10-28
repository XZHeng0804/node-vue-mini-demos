const crypto = require('crypto')
const Redis = require('ioredis')

/**
 * Redis 滑动窗口（ZSET 实现）
 * 每个 key 一个有序集合：score = 请求时间戳，value = 唯一成员。
 * 用 Lua 保证「清理 + 计数 + 写入 + 续期」的原子性，避免并发下超发。
 */
const LUA_SCRIPT = `
local key = KEYS[1]
local now = tonumber(ARGV[1])
local window = tonumber(ARGV[2])
local limit = tonumber(ARGV[3])
local member = ARGV[4]

-- 移除窗口之外的历史请求
redis.call('ZREMRANGEBYSCORE', key, '-inf', now - window)
local total = redis.call('ZCARD', key)

if total < limit then
  redis.call('ZADD', key, now, member)
  redis.call('PEXPIRE', key, window)
  return {1, total + 1}
end

-- 超额：返回最早一条请求的时间戳，用于计算重试等待时间
local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
return {0, oldest[2] or tostring(now)}
`

class RedisSlidingWindow {
  /**
   * @param {object} options
   * @param {string} options.host
   * @param {number} options.port
   * @param {string} [options.password]
   * @param {number} [options.db]
   * @param {string} [options.keyPrefix]
   */
  constructor(options = {}) {
    const { host, port, password, db, keyPrefix = 'rl:' } = options
    this.keyPrefix = keyPrefix
    this.client = new Redis({
      host,
      port,
      password,
      db,
      // 限流场景快速失败，避免请求长时间挂起
      maxRetriesPerRequest: 2,
    })

    // 必须监听 error，否则连接异常会变成未捕获的 error 事件
    this.client.on('error', err => {
      console.error('[rateLimit][redis]', err.message)
    })

    this.client.defineCommand('slidingWindow', {
      numberOfKeys: 1,
      lua: LUA_SCRIPT,
    })
  }

  /**
   * 尝试占用一个配额
   * @param {string} key
   * @param {number} limit
   * @param {number} windowMs
   */
  async acquire(key, limit, windowMs) {
    if (limit <= 0) {
      return { allowed: true, total: 0, remaining: Number.POSITIVE_INFINITY, resetAt: Date.now() + windowMs, retryAfter: 0 }
    }

    const now = Date.now()
    const member = `${now}-${crypto.randomBytes(4).toString('hex')}`

    const [allowedFlag, value] = await this.client.slidingWindow(
      `${this.keyPrefix}${key}`,
      now,
      windowMs,
      limit,
      member,
    )

    if (allowedFlag === 1) {
      const total = Number(value)
      return {
        allowed: true,
        total,
        remaining: Math.max(0, limit - total),
        resetAt: now + windowMs,
        retryAfter: 0,
      }
    }

    const oldest = Number(value)
    const resetAt = oldest + windowMs
    return {
      allowed: false,
      total: limit,
      remaining: 0,
      resetAt,
      retryAfter: Math.max(0, resetAt - now),
    }
  }

  reset(key) {
    return this.client.del(`${this.keyPrefix}${key}`)
  }

  async close() {
    await this.client.quit()
  }
}

module.exports = RedisSlidingWindow
