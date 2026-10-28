const MemorySlidingWindow = require('./memoryStore')
const RedisSlidingWindow = require('./redisStore')
const config = require('../../config')

let instance = null

/**
 * 创建滑动窗口实例
 * @param {object} [options]
 * @param {'memory'|'redis'} [options.store] 默认取环境变量 RATE_LIMIT_STORE
 */
const createSlidingWindow = (options = config.rateLimit) => {
  const store = options.store || config.rateLimit.store
  if (store === 'redis') {
    return new RedisSlidingWindow(config.redis)
  }
  return new MemorySlidingWindow()
}

// 进程内复用一个实例（内存实现必须复用，否则计数不共享）
const getSlidingWindow = () => {
  if (!instance) {
    instance = createSlidingWindow()
    console.log(`[rateLimit] 使用 ${config.rateLimit.store} 滑动窗口`)
  }
  return instance
}

const closeSlidingWindow = async () => {
  if (!instance) return
  const current = instance
  instance = null
  await current.close()
}

module.exports = {
  createSlidingWindow,
  getSlidingWindow,
  closeSlidingWindow,
  MemorySlidingWindow,
  RedisSlidingWindow,
}
