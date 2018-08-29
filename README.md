# 智课MOBA人工智能比赛服务端

## 部署流程

1. 安装redis-server，监听本地6379端口（大概需要4G左右内存）
2. 安装node（至少8.0以上，推荐使用nvm安装）
3. 进入主目录，安装依赖（yarn或者npm install）
4. 解压缩预加载数据 unzip bin/grids.path.map.zip（请解压缩到bin目录下）
5. 载入预加载数据 node index set_path（需要等待一段时间，完成后会自动退出）
6. 载入预加载数据第二部分 node index set_connect（需要等待一丢丢时间，完成后会自动退出）
7. 运行程序（node index或者用pm2监听）

## 如何使用本地服务器

1. 假设本地服务器的IP位serverIP
2. 浏览器访问访问serverIP:6688端口加载游戏平台，并附带server参数，值为serverIP，例如：使用本地服务器进行编号为10和编号为11的玩家对战，访问http://serverIP:6688?id=10v11&server=serverIP
3. 玩家编写程序，使用websocket连接使用serverIP:7788进行交互

## 队伍信息设置

- 请修改common/teams.js文件，设置队伍信息
- 只有在common/teams.js文件里设置了的队伍，才能够使用你的平台进行对战
- 队伍编号请从10开始编
- 本地server版不提供电脑，可用demo程序模拟

## 由于时间仓促，服务端还不够稳定，以及存在内存的问题，必要时请重启
