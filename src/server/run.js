import Exception from 'common/exception';

// 运行
export default (socket, action, params = {}) => {
  // 执行方法
  action(socket, params).catch((e) => {
    if (e instanceof Exception) {
      socket.send(JSON.stringify({
        type: 'cmdError',
        cmd: params,
        message: e.message,
      }));
    } else {
      console.log(e);
      socket.send(JSON.stringify({
        type: 'cmdError',
        cmd: params,
        message: '未知错误',
      }));
    }
  });
};
