import WebSocket from 'ws';

// 启动websocket服务器
export default new WebSocket.Server({ port: 7788 });
console.log('😈  游戏已启动，找点乐子吧');
