// 成功
exports.success = function (data, msg = 'success') {
  return {
    code: 200,
    data,
    msg
  }
}
// 业务失败
exports.fail = function (msg = 'fail', code = 400, data = null) {
  return {
    code,
    data,
    msg
  }
}
