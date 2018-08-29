import uuid from 'uuid';
import express from 'express';
import path from 'path';
import server from 'common/websocket';
import run from 'server/run';
import user from 'services/user';
import game from 'services/game';

// 启动express
const app = express();
app.use(express.static(path.join(__dirname, '../../public'), { maxAge: 86400000 * 30 }));
app.listen(6688);

// 恢复游戏
game.resume();
game.clean();

// 监听连接
server.on('connection', (socket) => {
  socket.id = uuid.v1();

  socket.on('message', (message) => {
    // 检查指令是否错误
    let params;
    try {
      params = JSON.parse(message);
    } catch (e) {
      socket.send(JSON.stringify({
        type: 'cmdError',
        cmd: message,
        message: '指令解析错误',
      }));
      return;
    }

    // 检查是否超过发送限制
    const limitKey = parseInt(new Date().getTime() / 1000, 10);
    socket[`limit${limitKey}`] = socket[`limit${limitKey}`] || 0;
    socket[`limit${limitKey}`] += 1;
    if (socket.teamId !== 'ai' && socket[`limit${limitKey}`] > 200) {
      socket.send(JSON.stringify({
        type: 'cmdError',
        cmd: params,
        message: '超过每秒发送限制',
      }));
      return;
    }

    switch (params.type) {
      case 'init':
        run(socket, game[params.type].bind(game), params);
        break;
      case 'join':
      case 'aiJoin':
      case 'pickHero':
      case 'move':
      case 'stop':
      case 'attack':
      case 'fire':
      case 'transmit':
        run(socket, user[params.type].bind(user), params);
        break;
      default:
        socket.send(JSON.stringify({
          type: 'cmdError',
          cmd: params,
          message: '指令不存在',
        }));
        break;
    }
  });
});
