koa洋葱模型
1. `index` 的作用是什么？
   用于记录当前执行的中间件索引，初始值为 -1。
2. `() => dispatch(i+1)` 就是我们写的 `next()` 吗？
   是的，`next()` 是一个函数，用于调用下一个中间件。
3. 为什么要包一层 `Promise.resolve`？
   为了处理异步中间件，确保每个中间件都能正确执行。
4. 如果某个中间件不写 `await next()`，会发生什么？
   如果某个中间件不写 `await next()`，那么它就会直接返回，不会调用下一个中间件。

1. `app.callback()` 对应原生 http 服务的回调，Koa 源码也是这个结构，看懂了吗？
   是的，`app.callback()` 是 Koa 应用的入口，它返回一个函数，用于创建 http 服务。
2. ctx 在这里只放了 req、res；真实 Koa 的 ctx 多了什么？
   多了其他属性，比如 `body`、`status` 等。
3. 错误在哪里捕获？这个捕获能抓到 Promise 里面裸抛、没有 await 的异常吗？
   是的，`app.callback()` 里面捕获了所有异常，包括 Promise 里面裸抛的异常。
   没有 await 的异常，因为 Koa 中的中间件都是异步的，不会直接抛出异常。