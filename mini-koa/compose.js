//koa洋葱模型
function compose(middlewareList) {
    // 洋葱模型
  return function (ctx) {
    let index = -1;
    // 递归调用中间件
    // 每个中间件都有一个 next 函数，用于调用下一个中间件
    function dispatch(i) {
     if(i<=index){
        throw new Error('next() 不能多次调用');
     }
  
     index = i;
     const fn = middlewareList[i];
     // 如果当前中间件不存在，直接返回 Promise.resolve()
     // 这是为了处理最后一个中间件的 next 函数
     // 它会调用 Promise.resolve() 来结束递归
     if(!fn) return Promise.resolve();
     return Promise.resolve(fn(ctx,()=> dispatch(i+1)));
    }

    return dispatch(0);
  }
}
class miniKoa{
    // 洋葱模型
    constructor(){
        this.middlewareList = [];
    }
    
    use(fn){
        this.middlewareList.push(fn);
    }
    // 洋葱模型
    callback(){
        const fn = compose(this.middlewareList);
        return(req,res) => {
            const ctx = {req,res};
            // 只执行一次中间件链，避免重复写响应
            fn(ctx).catch((err) => {
                // 如果响应已经结束，不要再 end
                if (res.writableEnded) return;
                res.statusCode = 500;
                res.end(JSON.stringify({ code: -1, msg: err.message }));
            });
        }
    }
}
//路由
function Router(){
    const router =[];
  return {

    get(path,handler){
      router.push({method:'GET',path,handler});
    },
    // 路由中间件
    middleware(){
      return async(ctx,next)=>{
        const{method,url} = ctx.req;
        for(const r of router){
          if(r.method === method && url === r.path){
            await r.handler(ctx,next);
            return;
          }
        }
      };
    }
  }
}


// 测试
const app = new miniKoa();
const router = new Router();

router.get('/',async(ctx,next)=>{
    ctx.res.end("hello mini koa");
});

router.get('/list',async(ctx,next)=>{
    ctx.res.end("list");
});
// 路由中间件
app.use(router.middleware());



//// 日志中间件
// app.use(async (ctx, next) => {
//   const start = Date.now();

//   await next();
//   const cost = Date.now() - start;
//   console.log(ctx.res.statusCode);
//   console.log(`path:${ctx.req.url}, cost:${cost}ms`);
// });

// app.use(async (ctx, next) => {
//   ctx.res.end("ok");
// });

// 捕获业务异常
// app.use(async (ctx,nest)=>{
//     try{
//         await nest();
//     }catch(err){
//         console.log("捕获业务异常：", err.message);
//         ctx.res.statusCode = 400;
//         ctx.res.end(JSON.stringify({ code: -1, msg: err.message }));
//         return;
//     }
// })

// app.use(async (ctx, next) => {
//   throw new Error("接口参数错误");
// });
//demo2
// app.use(async (ctx, next) => {
//     console.log("sm1 before next");
//     await next();
//     console.log("sm1 after next");
// });
// app.use(async (ctx, next) => {
//     console.log("sm2 before next");
//     ctx.res.write("hello mini koa");
//     await next();
//     console.log("sm2 after next");
// });
// 测试
// 启动服务器
const server = require("http").createServer(app.callback());
server.listen(3000, () => {
    console.log("server is running at http://localhost:3000");
});


//demo1 测试
// const m1 = async (ctx, next) => {
//   console.log("m1 before next");
//   await next();
//   console.log("m1 after next");
// };
// const m2 = async (ctx, next) => {
//   console.log("m2 before next");
//   await next();
//   console.log("m2 after next");
// };
// const m3 = async (ctx, next) => {
//   console.log("m3 before next");
//   await next();
//   console.log("m3 after next");
// };

// const run = compose([m1, m2, m3]);
// const ctx = { msg: "test" };
// run(ctx);