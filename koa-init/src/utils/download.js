const path = require('path')
const fs = require('fs')
const mime = require('mime-types')
const config = require('../config')
const { BusinessError } = require('../middleware/errorHandler')

// 解析并校验文件名，只允许纯文件名，禁止 ../ 之类的路径穿越
const resolveSafePath = filename => {
  if (!filename || typeof filename !== 'string') {
    throw new BusinessError('文件名不合法', 400)
  }
  const base = path.basename(filename)
  if (base !== filename || base === '.' || base === '..') {
    throw new BusinessError('文件名不合法', 400)
  }
  const filePath = path.join(config.upload.dir, base)
  const relative = path.relative(config.upload.dir, filePath)
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new BusinessError('文件名不合法', 400)
  }
  return filePath
}

// RFC 5987 编码，兼容中文文件名
const buildDisposition = (type, name) => {
  const asciiName = name.replace(/[^\x20-\x7e]/g, '_').replace(/"/g, '')
  return `${type}; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(name)}`
}

/**
 * 流式响应文件
 * @param {import('koa').Context} ctx
 * @param {string} filename 上传目录下的文件名
 * @param {object} options
 * @param {string} [options.downloadName] 下载时展示的文件名，默认同 filename
 * @param {boolean} [options.inline] true 浏览器内预览，false 强制下载
 */
const sendFile = async (ctx, filename, options = {}) => {
  const filePath = resolveSafePath(filename)

  let stat
  try {
    stat = await fs.promises.stat(filePath)
  } catch {
    throw new BusinessError('文件不存在', 404)
  }
  if (!stat.isFile()) {
    throw new BusinessError('文件不存在', 404)
  }

  const downloadName = path.basename(options.downloadName || filename)

  ctx.status = 200
  ctx.set('Content-Type', mime.lookup(filename) || 'application/octet-stream')
  ctx.set('Content-Length', String(stat.size))
  ctx.set('Content-Disposition', buildDisposition(options.inline ? 'inline' : 'attachment', downloadName))

  const stream = fs.createReadStream(filePath)
  ctx.body = stream

  // 客户端提前断开时销毁读流，避免文件句柄泄漏
  ctx.res.on('close', () => stream.destroy())
}

module.exports = {
  sendFile,
  resolveSafePath,
}
