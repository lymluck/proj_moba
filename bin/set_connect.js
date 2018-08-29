import redis from 'redis';
import bluebird from 'bluebird';
import grids from 'common/grids';

bluebird.promisifyAll(redis.RedisClient.prototype);

// 计算空点数量
const client = redis.createClient('6379', '127.0.0.1');
const map = {};
const isConnect = {};
const cal = async () => {
  for (let x1 = 0; x1 < grids.length; x1++) {
    for (let y1 = 0; y1 < grids[x1].length; y1++) {
      if (isConnect[`${x1}-${y1}-66-52`] === undefined) {
        isConnect[`${x1}-${y1}-66-52`] = await client.getAsync(`${x1}-${y1}-66-52`);
        isConnect[`${x1}-${y1}-66-52`] = !!isConnect[`${x1}-${y1}-66-52`];
      }

      if (grids[x1][y1] === '.' && isConnect[`${x1}-${y1}-66-52`]) {
        continue;
      }

      let nearestX;
      let nearestY;
      let nearestDistance;
      for (let x2 = 0; x2 < grids.length; x2++) {
        for (let y2 = 0; y2 < grids[x2].length; y2++) {
          if (isConnect[`${x2}-${y2}-66-52`] === undefined) {
            isConnect[`${x2}-${y2}-66-52`] = await client.getAsync(`${x2}-${y2}-66-52`);
            isConnect[`${x2}-${y2}-66-52`] = !!isConnect[`${x2}-${y2}-66-52`];
          }

          if (grids[x2][y2] !== '.' || !isConnect[`${x2}-${y2}-66-52`]) {
            continue;
          }

          const distance = Math.sqrt(Math.pow(x1 - x2, 2) + Math.pow(y1 - y2, 2));
          if (!nearestDistance || distance < nearestDistance) {
            nearestX = x2;
            nearestY = y2;
            nearestDistance = distance;
          }
        }
      }

      map[`${x1}-${y1}`] = `${nearestX},${nearestY}`;
      await client.setAsync(
        `${x1}-${y1}`,
        `${nearestX},${nearestY}`,
      );
      console.log(x1, y1);
    }
  }

  process.exit(0);
};
cal();
