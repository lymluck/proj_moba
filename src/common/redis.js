import redis from 'redis';
import bluebird from 'bluebird';

bluebird.promisifyAll(redis.RedisClient.prototype);
const client = redis.createClient();

// 设置
export const set = async (key, value) => {
  await client.setAsync(key, JSON.stringify(value));
};

// 获取
export const get = async (key, isReturnRaw = false) => {
  const value = await client.getAsync(key);

  if (isReturnRaw) {
    return value;
  }

  try {
    return JSON.parse(value);
  } catch (e) {
    return null;
  }
};
