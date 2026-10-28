const path = require('path')
const dotenv = require('dotenv')

// 按 NODE_ENV 加载对应环境变量文件（默认 dev）
const env = process.env.NODE_ENV || 'dev'
dotenv.config({ path: path.resolve(__dirname, `../.env.${env}`) })

const toInt = (value, defaultValue) => {
  const num = Number(value)
  return Number.isFinite(num) ? num : defaultValue
}

module.exports = {
  env,
  port: toInt(process.env.PORT, 3000),
  // MySQL 连接池
  db: {
    host: process.env.DB_HOST || '127.0.0.1',
    port: toInt(process.env.DB_PORT, 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'koa_init',
    // 池内最大连接数
    connectionLimit: toInt(process.env.DB_POOL_SIZE, 10),
    // 等待队列上限，0 表示不限制
    queueLimit: toInt(process.env.DB_QUEUE_LIMIT, 0),
  },
  // Redis（滑动窗口可选用）
  redis: {
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: toInt(process.env.REDIS_PORT, 6379),
    password: process.env.REDIS_PASSWORD || undefined,
    db: toInt(process.env.REDIS_DB, 0),
    keyPrefix: process.env.REDIS_KEY_PREFIX || 'rl:',
  },
  // 文件上传下载
  upload: {
    dir: path.resolve(process.cwd(), process.env.UPLOAD_DIR || 'uploads'),
    maxSize: toInt(process.env.UPLOAD_MAX_SIZE, 10 * 1024 * 1024),
    maxFiles: toInt(process.env.UPLOAD_MAX_FILES, 10),
    // 允许的 MIME 类型，留空表示不限制
    allowedTypes: (process.env.UPLOAD_ALLOWED_TYPES || '')
      .split(',')
      .map(item => item.trim())
      .filter(Boolean),
  },
  // 滑动窗口限流
  rateLimit: {
    // memory：单实例内存实现；redis：Redis ZSET 实现
    store: process.env.RATE_LIMIT_STORE || 'memory',
    limit: toInt(process.env.RATE_LIMIT_LIMIT, 100),
    windowMs: toInt(process.env.RATE_LIMIT_WINDOW_MS, 60 * 1000),
  },
}
