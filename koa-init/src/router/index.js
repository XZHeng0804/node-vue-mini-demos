const Router = require('@koa/router')
const userRouter = require('./user')
const router = new Router()

router.use('/user', userRouter.routes(), userRouter.allowedMethods())

module.exports = router
