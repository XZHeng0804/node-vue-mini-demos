const jwt = require('jsonwebtoken')
const { fail } = require('../utils/response')
const { BusinessError } = require('./errorHandler')

const auth = async (ctx, next) => {
  const token = ctx.headers.authorization?.replace('Bearer ', '')
  if (!token) {
    throw new BusinessError('token缺失', 401)
  }

  let payload
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET)
  } catch (e) {
    // 只把校验失败转成 401，避免吞掉下游业务异常
    throw new BusinessError('token无效或已过期', 401)
  }

  ctx.user = payload // 挂载用户信息到ctx，路由里面直接用
  await next()
}
module.exports = auth
