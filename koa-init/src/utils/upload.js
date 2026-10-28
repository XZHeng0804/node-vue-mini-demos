const path = require('path')
const fs = require('fs')
const crypto = require('crypto')
const multer = require('@koa/multer')
// @koa/multer 没有透出 MulterError，需要从 multer 本体取
const { MulterError } = require('multer')
const config = require('../config')
const { BusinessError } = require('../middleware/errorHandler')

// 确保上传目录存在
fs.mkdirSync(config.upload.dir, { recursive: true })

// 磁盘存储：文件名 = 时间戳 + 随机串 + 原扩展名，避免重名与路径注入
const storage = multer.diskStorage({
  destination(req, file, cb) {
    cb(null, config.upload.dir)
  },
  filename(req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase()
    cb(null, `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ext}`)
  },
})

const allowedTypes = new Set(config.upload.allowedTypes)

const fileFilter = (req, file, cb) => {
  if (allowedTypes.size && !allowedTypes.has(file.mimetype)) {
    return cb(new BusinessError(`不支持的文件类型：${file.mimetype}`, 400))
  }
  cb(null, true)
}

const uploader = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: config.upload.maxSize,
    files: config.upload.maxFiles,
  },
})

// 把 multer 的错误码翻译成业务错误，交给全局 errorHandler 统一输出
const normalizeError = err => {
  if (!(err instanceof MulterError)) return err
  const messages = {
    LIMIT_FILE_SIZE: '文件超出大小限制',
    LIMIT_FILE_COUNT: '文件数量超出限制',
    LIMIT_UNEXPECTED_FILE: '上传字段名或文件数量不正确',
    LIMIT_PART_COUNT: '表单分段数量超出限制',
  }
  return new BusinessError(messages[err.code] || err.message, 400)
}

// 包一层：捕获 multer 抛出的错误并转成业务错误
const wrap = middleware => async (ctx, next) => {
  try {
    await middleware(ctx, next)
  } catch (err) {
    throw normalizeError(err)
  }
}

/**
 * 单文件上传
 * @param {string} field 表单字段名，默认 file
 * 上传成功后文件信息在 ctx.file
 */
const single = (field = 'file') => wrap(uploader.single(field))

/**
 * 多文件上传（同一字段）
 * 上传成功后文件列表在 ctx.files
 */
const array = (field = 'file', maxCount = config.upload.maxFiles) =>
  wrap(uploader.array(field, maxCount))

/**
 * 多字段上传
 * 用法：fields([{ name: 'avatar', maxCount: 1 }, { name: 'photos', maxCount: 5 }])
 * 上传成功后信息在 ctx.files
 */
const fields = fieldMap => wrap(uploader.fields(fieldMap))

/**
 * 只接收文本字段，不接受文件
 */
const none = () => wrap(uploader.none())

module.exports = {
  uploadDir: config.upload.dir,
  single,
  array,
  fields,
  none,
}
