# koa-init 使用文档

`koa-init` 是一个 Koa 3 脚手架，内置：文件上传下载、MySQL 连接池、滑动窗口限流、JWT 认证、统一响应与错误处理。

## 目录

1. [快速开始](#一快速开始)
2. [项目结构](#二项目结构)
3. [配置模块](#三配置模块)
4. [日志](#四日志)
5. [文件上传](#五文件上传)
6. [文件下载](#六文件下载)
7. [MySQL 连接池](#七mysql-连接池)
8. [滑动窗口限流](#八滑动窗口限流)
9. [JWT 认证](#九jwt-认证)
10. [统一响应与错误处理](#十统一响应与错误处理)
11. [路由与新增模块](#十一路由与新增模块)
12. [优雅关闭与部署](#十二优雅关闭与部署)
13. [常见问题](#十三常见问题)

---

## 一、快速开始

### 1.1 环境要求

- Node.js >= 18（已在 v22 验证）
- MySQL 5.7+ / 8.x（仅在使用数据库时需要）
- Redis 6+（仅 `RATE_LIMIT_STORE=redis` 时需要）

### 1.2 安装与启动

```bash
npm install
npm run dev     # node --watch src/app.js，开发热重载
npm run start   # node src/app.js
```

启动成功输出：

```
◇ injected env (22) from src/.env.dev
[rateLimit] 使用 memory 滑动窗口
server is running at http://localhost:3000 (env: dev)
```

### 1.3 验证

```bash
curl -X POST -F "file=@test.png" http://localhost:3000/user/upload
curl -OJ "http://localhost:3000/user/files/<filename>"
```

### 1.4 环境切换

```bash
NODE_ENV=prod npm run start   # 加载 src/.env.prod，端口 8080
```

未设置 `NODE_ENV` 时默认加载 `src/.env.dev`。

---

## 二、项目结构

```
koa-init/
├── docs/api.md                    # 本文档
├── package.json                   # start / dev 脚本
├── uploads/                       # 运行时创建的上传目录
└── src/
    ├── app.js                     # 应用装配与优雅关闭
    ├── .env.dev                   # 开发环境变量
    ├── .env.prod                  # 生产环境变量
    ├── config/index.js            # 环境变量加载与统一配置
    ├── db/index.js                # MySQL 连接池封装
    ├── middleware/
    │   ├── errorHandler.js        # 全局异常 / 404 兜底 / 进程级兜底
    │   ├── logger.js              # 访问日志
    │   ├── rateLimit.js           # 限流中间件
    │   └── auth.js                # JWT 认证
    ├── router/
    │   ├── index.js               # 路由聚合
    │   └── user.js                # 上传 / 下载示例路由
    └── utils/
        ├── response.js            # success / fail
        ├── upload.js              # multer 上传封装
        ├── download.js            # 流式下载封装
        └── rateLimit/
            ├── index.js           # 工厂与单例
            ├── memoryStore.js     # 内存单实例实现
            └── redisStore.js      # Redis ZSET 实现
```

模块职责速查：

| 模块 | 引入方式 | 主要导出 |
| --- | --- | --- |
| 配置 | `require('./config')` | `config` 对象 |
| 上传 | `require('./utils/upload')` | `single / array / fields / none` |
| 下载 | `require('./utils/download')` | `sendFile / resolveSafePath` |
| 数据库 | `require('./db')` | `query / execute / transaction / healthCheck / close / getPool` |
| 限流中间件 | `require('./middleware/rateLimit')` | `rateLimit(options)` |
| 限流存储 | `require('./utils/rateLimit')` | `createSlidingWindow / getSlidingWindow / closeSlidingWindow / MemorySlidingWindow / RedisSlidingWindow` |
| 认证 | `require('./middleware/auth')` | `auth` |
| 响应 | `require('./utils/response')` | `success / fail` |
| 错误 | `require('./middleware/errorHandler')` | `errorHandler / BusinessError` |

---

## 三、配置模块

`src/config/index.js` 在首次 `require` 时完成两件事：

1. 按 `NODE_ENV` 加载对应 `.env` 文件（`dotenv` 不会覆盖已存在的进程环境变量，命令行传入的变量优先级更高）；
2. 把环境变量整理成带类型转换和默认值的配置对象。

```js
const config = require('./config')

config.env                    // 'dev' | 'prod'
config.port                   // 3000
config.db.host                // '127.0.0.1'
config.db.connectionLimit     // 10
config.upload.dir             // 绝对路径，默认 <cwd>/uploads
config.rateLimit.store        // 'memory' | 'redis'
```

### 3.1 新增配置项

在 `src/config/index.js` 中追加字段即可，读取处无需再关心 `process.env`：

```js
module.exports = {
  // ...
  sms: {
    sign: process.env.SMS_SIGN || 'koa-init',
    timeout: toInt(process.env.SMS_TIMEOUT, 5000),
  },
}
```

### 3.2 环境变量总表

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `NODE_ENV` | `dev` | 决定加载 `.env.dev` / `.env.prod` |
| `PORT` | `3000`（prod 8080） | 监听端口 |
| `JWT_SECRET` | `dev_secret_123` | JWT 签名密钥，生产必须替换 |
| `DB_HOST` | `127.0.0.1` | MySQL 主机 |
| `DB_PORT` | `3306` | MySQL 端口 |
| `DB_USER` | `root` | MySQL 用户 |
| `DB_PASSWORD` | 空 | MySQL 密码 |
| `DB_NAME` | `koa_init` | 数据库名 |
| `DB_POOL_SIZE` | `10`（prod 20） | 池内最大连接数 |
| `DB_QUEUE_LIMIT` | `0`（prod 100） | 等待队列上限，0 为不限 |
| `REDIS_HOST` | `127.0.0.1` | Redis 主机 |
| `REDIS_PORT` | `6379` | Redis 端口 |
| `REDIS_PASSWORD` | 空 | Redis 密码 |
| `REDIS_DB` | `0` | Redis 库号 |
| `REDIS_KEY_PREFIX` | `rl:` | 限流 key 前缀 |
| `UPLOAD_DIR` | `uploads` | 上传目录，相对进程工作目录（`cwd`） |
| `UPLOAD_MAX_SIZE` | `10485760` | 单文件最大字节数（10MB） |
| `UPLOAD_MAX_FILES` | `10` | 单次请求最大文件数 |
| `UPLOAD_ALLOWED_TYPES` | `image/png,image/jpeg,application/pdf` | MIME 白名单，逗号分隔，留空不限制 |
| `RATE_LIMIT_STORE` | `memory`（prod `redis`） | 限流存储实现 |
| `RATE_LIMIT_LIMIT` | `100` | 窗口内最大请求数 |
| `RATE_LIMIT_WINDOW_MS` | `60000` | 窗口长度（毫秒） |

---

## 四、日志

`src/middleware/logger.js` 记录每个请求的耗时：

```js
const logger = require('./middleware/logger')
app.use(logger)
```

输出格式：

```
[2026-10-28T03:13:57.521Z] POST /user/upload status:200 cost:5ms
```

说明：

- 该中间件很轻量，只 `console.log`，便于本地调试；
- 生产建议替换为 `pino` / `winston`，并与 access log、错误日志分流；
- 请求抛出异常时不会输出该行（异常由 `errorHandler` 记录）。

---

## 五、文件上传

```js
const { single, array, fields, none } = require('./utils/upload')
```

上传目录（`UPLOAD_DIR`）在模块加载时自动创建，文件名为「时间戳 + 随机串 + 原扩展名」，不会与已有文件重名，也不会把用户文件名拼进路径。

### 5.1 单文件上传

```js
const Router = require('@koa/router')
const { single } = require('../utils/upload')
const { success } = require('../utils/response')

const router = new Router()

router.post('/upload', single('file'), async ctx => {
  const { filename, originalname, size, mimetype } = ctx.file
  ctx.body = success({ filename, url: `/user/files/${filename}` })
})
```

上传成功后文件对象挂在 `ctx.file`（同时也挂在 `ctx.request.file`）：

| 字段 | 说明 |
| --- | --- |
| `filename` | 落盘文件名（时间戳 + 随机串 + 原扩展名） |
| `originalname` | 客户端原始文件名 |
| `size` | 文件字节数 |
| `mimetype` | 客户端声明的 MIME |
| `path` | 绝对路径 |
| `destination` | 上传目录 |

### 5.2 多文件上传

```js
// 同一字段多个文件，最多 5 个
router.post('/uploads', array('files', 5), async ctx => {
  ctx.body = success(ctx.files.map(f => f.filename))
})

// 多字段分别限制数量
router.post(
  '/profile',
  fields([{ name: 'avatar', maxCount: 1 }, { name: 'photos', maxCount: 5 }]),
  async ctx => {
    // ctx.files = { avatar: [...], photos: [...] }
    ctx.body = success(Object.keys(ctx.files))
  }
)

// 只收文本字段，不接收文件
router.post('/form', none(), async ctx => {
  ctx.body = success(ctx.request.body)
})
```

`array` 的结果在 `ctx.files`（数组），`fields` 的结果在 `ctx.files`（对象）。

### 5.3 限制与错误

限制项来自环境变量（见 [3.2](#32-环境变量总表)）。封装内部会把 multer 错误统一转成业务错误：

| 触发场景 | 响应体 |
| --- | --- |
| 文件超大小 | `{"code":400,"data":null,"msg":"文件超出大小限制"}` |
| 文件数超限 | `{"code":400,"data":null,"msg":"文件数量超出限制"}` |
| 字段名不匹配 | `{"code":400,"data":null,"msg":"上传字段名或文件数量不正确"}` |
| MIME 不在白名单 | `{"code":400,"data":null,"msg":"不支持的文件类型：text/plain"}` |

> 业务错误的 HTTP 状态码仍是 200，真实错误码在响应体 `code` 字段；只有未预期异常才返回 HTTP 500。

### 5.4 自定义存储

当前封装固定使用磁盘存储。若要改成内存、OSS、S3，直接替换 `upload.js` 中的 `storage`：

```js
// 内存存储，之后自行上传到对象存储，file.buffer 即文件内容
const storage = multer.memoryStorage()

const uploader = multer({ storage, fileFilter, limits })
```

### 5.5 前端调用示例

```js
const form = new FormData()
form.append('file', fileInput.files[0])

await fetch('/user/upload', { method: 'POST', body: form })
```

> 不要手动设置 `Content-Type`，浏览器会自动补上 `boundary`。

### 5.6 文件清理

上传的文件会一直保留在 `UPLOAD_DIR`，脚手架不做自动清理。生产环境建议按业务补一个定时任务，或对接对象存储的生命周期规则。同时建议把 `uploads/` 加入 `.gitignore`。

---

## 六、文件下载

```js
const { sendFile, resolveSafePath } = require('./utils/download')
```

### 6.1 强制下载

```js
router.get('/files/:filename', async ctx => {
  // downloadName 可选，用于指定下载时展示的文件名（支持中文）
  await sendFile(ctx, ctx.params.filename, { downloadName: ctx.query.name })
})
```

响应头：

```
Content-Type: application/pdf
Content-Length: 102400
Content-Disposition: attachment; filename="report.pdf"; filename*=UTF-8''%E6%8A%A5%E5%91%8A.pdf
```

### 6.2 浏览器内预览

```js
router.get('/preview/:filename', async ctx => {
  await sendFile(ctx, ctx.params.filename, { inline: true })
})
```

`inline: true` 时 `Content-Disposition` 为 `inline`，图片 / PDF 会直接在浏览器打开。

### 6.3 参数

| 参数 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `ctx` | `Koa.Context` | 必填 | 当前请求上下文 |
| `filename` | `string` | 必填 | 上传目录下的文件名 |
| `options.downloadName` | `string` | 同 `filename` | 下载时展示的文件名，支持中文 |
| `options.inline` | `boolean` | `false` | 是否浏览器内预览 |

### 6.4 安全与异常

- 只接受纯文件名，`../../etc/passwd`、`..%2F..%2Fpackage.json` 会抛 `BusinessError('文件名不合法', 400)`；
- 文件不存在抛 `BusinessError('文件不存在', 404)`；
- 使用流式输出，大文件不占内存；`ctx.res` 断开时自动销毁读流，避免句柄泄漏。

需要自行校验路径时：

```js
const { resolveSafePath } = require('../utils/download')

const fullPath = resolveSafePath('report.pdf') // 非法文件名直接抛 400
```

### 6.5 已知限制

- 不支持 `Range` 断头续传（没有 `Accept-Ranges` / 206），视频拖动、大文件续传场景需自行扩展；
- 大文件下载建议交给 Nginx（`X-Accel-Redirect`）或对象存储直链，Node 只负责鉴权。

---

## 七、MySQL 连接池

```js
const db = require('../db')
```

连接池为懒加载单例：进程内首次调用 `query / execute / transaction / healthCheck` 时创建，字符集 `utf8mb4`，时区 `+08:00`，开启 keep-alive。

### 7.1 查询

```js
// 返回结果行数组
const users = await db.query('SELECT id, name FROM users WHERE status = ?', [1])

// 写操作返回 ResultSetHeader（含 insertId / affectedRows）
const result = await db.execute('INSERT INTO users (name, status) VALUES (?, ?)', ['张三', 1])
console.log(result.insertId, result.affectedRows)
```

分页示例：

```js
const page = Number(ctx.query.page) || 1
const size = Math.min(Number(ctx.query.size) || 10, 100)
const offset = (page - 1) * size

const list = await db.query('SELECT id, name FROM users ORDER BY id DESC LIMIT ? OFFSET ?', [size, offset])
```

### 7.2 事务

回调内所有操作走同一个连接，抛错自动回滚，结束自动归还连接：

```js
await db.transaction(async conn => {
  await conn.query('UPDATE accounts SET balance = balance - ? WHERE id = ?', [100, 1])
  await conn.query('UPDATE accounts SET balance = balance + ? WHERE id = ?', [100, 2])
})
```

注意：事务回调内必须使用 `conn`，不要混用 `db.query`，否则那条 SQL 会走池里的另一条连接，不受事务控制。

### 7.3 健康检查与关闭

```js
await db.healthCheck() // true
const pool = db.getPool() // 需要底层 Pool 实例时使用
await db.close() // 结束连接池，app 已在 SIGINT/SIGTERM 中调用
```

### 7.4 使用约定

- 参数一律使用 `?` 占位符传参，不要拼接 SQL（`pool.query` 会做转义）；
- 不要手动 `getConnection()` 后忘记 `release()`，优先用 `query` / `transaction`；
- 单次请求内的多条读可以并发 `Promise.all`，但事务必须串行在同一个 `conn` 上；
- 连接池创建是懒加载，MySQL 不可用时首次请求才会报 `ECONNREFUSED`。

---

## 八、滑动窗口限流

```js
const rateLimit = require('./middleware/rateLimit')
const {
  createSlidingWindow,
  getSlidingWindow,
  closeSlidingWindow,
  MemorySlidingWindow,
  RedisSlidingWindow,
} = require('./utils/rateLimit')
```

### 8.1 全局 / 路由级使用

```js
// 全局：app.js 中
app.use(rateLimit())

// 路由级：登录接口单独收紧
router.post(
  '/login',
  rateLimit({ limit: 5, windowMs: 60 * 1000, keyGenerator: ctx => `login:${ctx.ip}` }),
  loginHandler
)
```

参数：

| 参数 | 默认值 | 说明 |
| --- | --- | --- |
| `limit` | `100` | 窗口内最大请求数，`<= 0` 视为不限流 |
| `windowMs` | `60000` | 窗口长度（毫秒） |
| `keyGenerator` | `ctx => ctx.ip` | 限流维度，可换成用户 ID、手机号等 |
| `store` | 全局单例 | 自定义存储，实现 `acquire(key, limit, windowMs)` 即可 |

### 8.2 响应头与超限返回

放行与拦截都会带：

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1793157358
```

被拦截时额外带 `Retry-After`（秒），HTTP 状态 429：

```json
{ "code": 429, "data": null, "msg": "请求过于频繁，请稍后再试" }
```

### 8.3 存储选型

```bash
RATE_LIMIT_STORE=memory   # 默认，单实例内存；重启清空，多进程不共享
RATE_LIMIT_STORE=redis    # 多实例共享，基于 ZSET + Lua
```

Redis 实现为每个 key 建一个 ZSET（score = 请求时间戳），Lua 脚本原子完成「清理过期成员 → 计数 → 写入 → 续期」；key 形如 `rl:127.0.0.1`，自动 `PEXPIRE` 过期，不会无限堆积。

### 8.4 手动使用与复用

```js
const { getSlidingWindow, MemorySlidingWindow } = require('../utils/rateLimit')

// 复用进程内单例（内存实现必须复用，否则计数不共享）
const store = getSlidingWindow()
const result = await store.acquire('user:1', 10, 60 * 1000)
// { allowed, total, remaining, resetAt, retryAfter }

// 或自建独立实例
const limiter = new MemorySlidingWindow({ cleanupInterval: 30 * 1000 })
await limiter.acquire('sms:13800000000', 1, 60 * 1000)
limiter.reset('sms:13800000000') // 手动清空某个 key
await limiter.close() // 停止清理定时器
```

`acquire` 返回值：

| 字段 | 说明 |
| --- | --- |
| `allowed` | 是否放行 |
| `total` | 当前窗口内计数 |
| `remaining` | 剩余额度 |
| `resetAt` | 最早记录滑出窗口的时间戳（ms） |
| `retryAfter` | 被拒时建议等待毫秒数，放行时为 0 |

`reset(key)` 可用于「登录成功后清空失败次数」这类场景。

### 8.5 使用约定

- 内存实现只适合单进程；PM2 cluster / 多 Pod 部署必须用 `redis`，否则每个进程各算一份；
- `ctx.ip` 依赖 `app.proxy = true` 与可信代理，直接暴露公网时不要盲信 `X-Forwarded-For`；
- `keyGenerator` 里的 key 建议加业务前缀（`login:`、`sms:`），避免不同接口互相挤占额度；
- 进程退出前调用 `closeSlidingWindow()`，`app.js` 已处理。

---

## 九、JWT 认证

```js
const auth = require('./middleware/auth')
```

### 9.1 保护路由

```js
const Router = require('@koa/router')
const auth = require('../middleware/auth')

const router = new Router()

router.get('/profile', auth, async ctx => {
  // 校验通过后，token 负载挂在 ctx.user
  ctx.body = success(ctx.user)
})
```

请求头格式：

```
Authorization: Bearer <token>
```

### 9.2 签发 token

```js
const jwt = require('jsonwebtoken')

const token = jwt.sign(
  { id: 1, name: '张三' },
  process.env.JWT_SECRET,
  { expiresIn: '2h' }
)
```

### 9.3 失败返回

| 场景 | 响应体 |
| --- | --- |
| 未携带 token | `{"code":401,"msg":"token缺失"}` |
| token 无效 / 过期 / 密钥不一致 | `{"code":401,"msg":"token无效或已过期"}` |

认证中间件只负责校验 token，下游业务异常会正常抛给全局错误处理，不会被误报成 401。

> `JWT_SECRET` 必须在 `.env.*` 中配置，且签发与校验使用同一密钥；生产环境务必替换默认值。

---

## 十、统一响应与错误处理

### 10.1 响应格式

`src/utils/response.js`：

```js
const { success, fail } = require('./utils/response')

success({ id: 1 })   // { code: 200, data: { id: 1 }, msg: 'success' }
fail('参数错误', 400) // { code: 400, data: null, msg: '参数错误' }
```

### 10.2 业务异常

推荐直接抛 `BusinessError`，由全局 `errorHandler` 统一格式化：

```js
const { BusinessError } = require('./middleware/errorHandler')

if (!user) throw new BusinessError('用户不存在', 404)
```

### 10.3 错误处理规则

`app.use(errorHandler)` 必须放在最外层（第一个注册），它会：

- 捕获 `BusinessError`：HTTP 200，响应体 `code` 为业务错误码；
- 捕获未知异常：HTTP 500，message 统一为「服务器内部错误」，不泄露堆栈；
- 404 兜底：`ctx.status === 404` 且无 `ctx.body` 时返回 `{"code":404,"msg":"接口不存在"}`；
- 注册 `unhandledRejection` / `uncaughtException`，防止裸 Promise 异常直接崩进程。

| 错误类型 | HTTP 状态 | 响应体 `code` |
| --- | --- | --- |
| `BusinessError` | 200 | 自定义（默认 400） |
| 未预期异常 | 500 | 500 |
| 限流拦截 | 429 | 429 |
| 路由不存在 | 200 | 404 |

> 前端判断成功与否应以 `body.code === 200` 为准，而不是只看 HTTP 状态码。

---

## 十一、路由与新增模块

### 11.1 现有结构

`src/router/index.js` 负责聚合子路由：

```js
const Router = require('@koa/router')
const userRouter = require('./user')

const router = new Router()

router.use('/user', userRouter.routes(), userRouter.allowedMethods())

module.exports = router
```

### 11.2 新增一个业务模块

1. 新建 `src/router/order.js`：

```js
const Router = require('@koa/router')
const { success, fail } = require('../utils/response')
const { BusinessError } = require('../middleware/errorHandler')

const router = new Router()

router.get('/:id', async ctx => {
  const { id } = ctx.params
  if (!/^\d+$/.test(id)) throw new BusinessError('id 不合法', 400)
  ctx.body = success({ id: Number(id) })
})

module.exports = router
```

2. 在 `src/router/index.js` 挂载：

```js
const orderRouter = require('./order')

router.use('/order', orderRouter.routes(), orderRouter.allowedMethods())
```

3. 路径即 `/order/:id`。`allowedMethods()` 负责方法不匹配时返回 405 并补 `Allow` 头。

### 11.3 JSON 请求体

脚手架当前没有内置 JSON 解析。`ctx.request.body` 仅在 multipart 表单（上传接口）中可用。若要接收 `application/json`：

```bash
npm install koa-bodyparser
```

```js
const bodyParser = require('koa-bodyparser')

app.use(bodyParser()) // 放在 router 之前
```

### 11.4 路由文件约定

- 一个文件一个 `Router` 实例，`module.exports = router`；
- 校验失败的参数直接抛 `BusinessError`，不要手动拼响应体；
- 业务返回值统一用 `success()` 包裹。

---

## 十二、优雅关闭与部署

### 12.1 关闭流程

`src/app.js` 监听 `SIGINT` / `SIGTERM`：

```js
process.on('SIGINT', () => shutdown('SIGINT'))
process.on('SIGTERM', () => shutdown('SIGTERM'))
```

收到信号后：停止接收新请求（`server.close`）→ 并行关闭连接池与限流存储 → 输出 `[shutdown] 已完成` → `process.exit(0)`。

### 12.2 部署示例

```bash
NODE_ENV=prod npm run start

# 或使用 PM2
pm2 start src/app.js --name koa-init --env production
pm2 reload koa-init   # 平滑重启，触发 SIGINT
```

注意事项：

- 生产环境 `RATE_LIMIT_STORE` 必须为 `redis`（多实例共享计数）；
- `UPLOAD_DIR` 基于进程工作目录，PM2 请固定 `cwd`，或改成绝对路径；
- 前置 Nginx 时开启 `app.proxy` 已配置，但需保证只信任自家代理的 `X-Forwarded-For`；
- `server.close` 不设超时，长连接 / keep-alive 可能延迟退出，必要时自行加超时兜底。

### 12.3 健康检查接口示例

```js
router.get('/health', async ctx => {
  await db.healthCheck()
  ctx.body = success({ status: 'ok' })
})
```

MySQL 不通时 `healthCheck` 会抛异常，由 `errorHandler` 返回 500，便于探针判断。

---

## 十三、常见问题

**1. 业务错误为什么 HTTP 状态码是 200？**

这是 `errorHandler` 的统一约定：HTTP 层只表示「请求是否被服务端处理」，业务结果看 `body.code`。限流（429）和未预期异常（500）除外。

**2. 上传返回「不支持的文件类型」怎么办？**

检查 `UPLOAD_ALLOWED_TYPES`，默认只允许 `image/png,image/jpeg,application/pdf`；留空则不做限制。

**3. 上传报目录不存在或文件找不到？**

`UPLOAD_DIR` 相对进程工作目录（`cwd`），需从项目根目录启动；目录会在模块加载时自动创建，若仍失败请检查读写权限。

**4. 限流不生效或计数不对？**

- 多进程 / 多实例部署时内存实现各自计数，需切 `RATE_LIMIT_STORE=redis`；
- 反向代理下 `ctx.ip` 可能都是同一个 IP，确认 `app.proxy` 与 `X-Forwarded-For`；
- 被限流后注意 `Retry-After`，本地压测很容易触发。

**5. 数据库报 `ECONNREFUSED`？**

连接池懒加载，首次请求才建连。确认 MySQL 已启动、`DB_*` 配置正确、账号有该库权限。

**6. 日志出现 `[rateLimit][redis] ...` 连接错误？**

`RATE_LIMIT_STORE=redis` 但 Redis 未启动或配置错误。开发环境可先改回 `memory`；该错误只打印日志，不会让进程崩溃。

**7. 带 token 仍返回 401？**

检查 `Authorization: Bearer <token>` 格式、token 是否过期、签发与校验的 `JWT_SECRET` 是否一致。

**8. POST JSON 拿不到 `ctx.request.body`？**

脚手架没有内置 body 解析，参考 [11.3](#113-json-请求体) 接入 `koa-bodyparser`。

**9. 上传的文件在哪里？怎么访问？**

物理文件在 `UPLOAD_DIR`（默认 `koa-init/uploads/`），没有静态托管；通过 `GET /user/files/:filename` 走鉴权下载，或 `GET /user/preview/:filename` 预览。

---

## 附：示例接口一览

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `POST` | `/user/upload` | 单文件上传，字段名 `file` |
| `GET` | `/user/files/:filename` | 下载文件，支持 `?name=` 指定下载名 |
| `GET` | `/user/preview/:filename` | 浏览器内预览 |

```bash
curl -X POST -F "file=@test.png" http://localhost:3000/user/upload
curl -OJ "http://localhost:3000/user/files/<filename>?name=%E4%B8%AD%E6%96%87.png"
```
