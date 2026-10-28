const mysql = require('mysql2/promise')
const config = require('../config')

let pool = null

// 懒加载单例连接池
const getPool = () => {
  if (!pool) {
    pool = mysql.createPool({
      host: config.db.host,
      port: config.db.port,
      user: config.db.user,
      password: config.db.password,
      database: config.db.database,
      // 池内最大连接数
      connectionLimit: config.db.connectionLimit,
      // 队列上限，0 为不限制
      queueLimit: config.db.queueLimit,
      // 连接耗尽时排队等待而不是直接报错
      waitForConnections: true,
      charset: 'utf8mb4',
      timezone: '+08:00',
      // 空闲连接保活，避免被数据库/中间件断开
      enableKeepAlive: true,
      keepAliveInitialDelay: 0,
    })

    pool.on('connection', () => {
      console.log('[db] 新建连接')
    })
  }
  return pool
}

/**
 * 执行查询
 * @param {string} sql
 * @param {Array} [params] 占位符参数
 * @returns {Promise<Array>} 查询结果行
 */
const query = async (sql, params = []) => {
  const [rows] = await getPool().query(sql, params)
  return rows
}

/**
 * 执行写操作（INSERT/UPDATE/DELETE）
 * @returns {Promise<import('mysql2').ResultSetHeader>}
 */
const execute = async (sql, params = []) => {
  const [result] = await getPool().query(sql, params)
  return result
}

/**
 * 事务封装，回调内使用同一连接，异常自动回滚
 * @param {(conn: import('mysql2/promise').PoolConnection) => Promise<any>} handler
 */
const transaction = async handler => {
  const conn = await getPool().getConnection()
  try {
    await conn.beginTransaction()
    const result = await handler(conn)
    await conn.commit()
    return result
  } catch (err) {
    try {
      await conn.rollback()
    } catch (rollbackErr) {
      console.error('[db] 事务回滚失败', rollbackErr)
    }
    throw err
  } finally {
    // 释放回连接池，不是真正关闭
    conn.release()
  }
}

// 健康检查，用于启动自检 / 探针
const healthCheck = async () => {
  const conn = await getPool().getConnection()
  try {
    await conn.ping()
    return true
  } finally {
    conn.release()
  }
}

// 优雅关闭：等待在用连接归还后结束池
const close = async () => {
  if (!pool) return
  const current = pool
  pool = null
  await current.end()
}

module.exports = {
  getPool,
  query,
  execute,
  transaction,
  healthCheck,
  close,
}
