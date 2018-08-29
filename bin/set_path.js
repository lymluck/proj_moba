import redis from 'redis';
import lineReader from 'line-reader';

const client = redis.createClient('6379', '127.0.0.1');
let count = 0;
const total = 19263321;
lineReader.eachLine('./bin/grids.path.map', (line) => {
  const array = line.split('|');
  const startPoint = { x: array[0].split(',')[0], y: array[0].split(',')[1] };
  const endPoint = { x: array[1].split(',')[0], y: array[1].split(',')[1] };
  const way = array[2].split(';').slice(0, -1);

  if (way.length > 0) {
    client.set(
      `${startPoint.x}-${startPoint.y}-${endPoint.x}-${endPoint.y}`,
      JSON.stringify(way),
      () => {
        count++;
      },
    );
  } else {
    count++;
  }
});

setInterval(() => {
  console.log(`${count}/${total} - ${(count / total * 100).toFixed(2)}%`);

  if (count === total) {
    process.exit(0);
  }
}, 1000);
