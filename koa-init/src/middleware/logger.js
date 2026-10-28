const logger = async (ctx, next) => {
  const start = Date.now()
  await next()
  const cost = Date.now() - start
  console.log(`[${new Date().toISOString()}] ${ctx.method} ${ctx.path} status:${ctx.status} cost:${cost}ms`)
}
module.exports = logger
