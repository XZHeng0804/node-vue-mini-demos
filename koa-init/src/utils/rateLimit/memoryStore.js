/**
 * 单实例内存滑动窗口
 * 用「每个 key 一个时间戳数组」记录窗口内的请求，避免固定窗口的临界突刺问题。
 * 仅适用于单进程部署；多实例需换 Redis 实现。
 */
class MemorySlidingWindow {
  /**
   * @param {object} [options]
   * @param {number} [options.cleanupInterval] 过期 key 清理间隔（毫秒）
   */
  constructor(options = {}) {
    const { cleanupInterval = 60 * 1000 } = options
    // key -> number[]（升序时间戳）
    this.records = new Map()
    this.cleanupTimer = setInterval(() => this.cleanup(), cleanupInterval)
    // 定时器不阻止进程退出
    this.cleanupTimer.unref?.()
  }

  /**
   * 尝试占用一个配额
   * @param {string} key 限流维度（IP / 用户ID / 接口）
   * @param {number} limit 窗口内允许的最大请求数
   * @param {number} windowMs 窗口长度（毫秒）
   */
  async acquire(key, limit, windowMs) {
    // limit <= 0 视为不限流
    if (limit <= 0) {
      return { allowed: true, total: 0, remaining: Number.POSITIVE_INFINITY, resetAt: Date.now() + windowMs, retryAfter: 0 }
    }

    const now = Date.now()
    const minTime = now - windowMs

    let timestamps = this.records.get(key)
    if (!timestamps) {
      timestamps = []
      this.records.set(key, timestamps)
    }

    // 移除窗口外的旧记录
    let expireIndex = 0
    while (expireIndex < timestamps.length && timestamps[expireIndex] <= minTime) {
      expireIndex += 1
    }
    if (expireIndex > 0) {
      timestamps.splice(0, expireIndex)
    }

    if (timestamps.length < limit) {
      timestamps.push(now)
      return {
        allowed: true,
        total: timestamps.length,
        remaining: limit - timestamps.length,
        resetAt: timestamps[0] + windowMs,
        retryAfter: 0,
      }
    }

    // 超额：最早一条滑出窗口后才能再放行
    const resetAt = timestamps[0] + windowMs
    return {
      allowed: false,
      total: timestamps.length,
      remaining: 0,
      resetAt,
      retryAfter: Math.max(0, resetAt - now),
    }
  }

  // 清理已空 / 全部过期的 key，防止内存无限增长
  cleanup() {
    const now = Date.now()
    for (const [key, timestamps] of this.records) {
      // 记录本身没有窗口信息，交给 acquire 时的惰性清理；
      // 这里只回收长时间没有请求的 key
      if (!timestamps.length) {
        this.records.delete(key)
      } else if (timestamps[timestamps.length - 1] < now - 60 * 60 * 1000) {
        this.records.delete(key)
      }
    }
  }

  // 重置某个 key（如登录成功后清空失败计数）
  reset(key) {
    this.records.delete(key)
  }

  async close() {
    clearInterval(this.cleanupTimer)
    this.records.clear()
  }
}

module.exports = MemorySlidingWindow
