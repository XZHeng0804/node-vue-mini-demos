const Router = require('@koa/router')
const { single } = require('../utils/upload')
const { sendFile } = require('../utils/download')
const { success } = require('../utils/response')

const router = new Router()

// 上传：字段名 file，上传后文件信息在 ctx.file
router.post('/upload', single('file'), async ctx => {
  const { filename, originalname, size, mimetype } = ctx.file
  ctx.body = success({
    filename,
    originalname,
    size,
    mimetype,
    url: `/user/files/${filename}`,
  })
})

// 下载：强制浏览器下载，可用 ?name=xxx 指定下载文件名
router.get('/files/:filename', async ctx => {
  await sendFile(ctx, ctx.params.filename, { downloadName: ctx.query.name })
})

// 预览：浏览器内直接打开
router.get('/preview/:filename', async ctx => {
  await sendFile(ctx, ctx.params.filename, { inline: true })
})

module.exports = router
