import { get } from 'common/redis';
import grids from 'common/grids';

// 获取移动步骤
export const getMoveSteps = async (p1, p2) => {
  let vp1 = {
    x: parseInt(p1.x / 32, 10),
    y: parseInt(p1.y / 32, 10),
  };

  const nearstVP1 = await get(`${vp1.x}-${vp1.y}`, true);
  if (nearstVP1) {
    vp1 = {
      x: nearstVP1.split(',')[0],
      y: nearstVP1.split(',')[1],
    };
  }

  let vp2 = {
    x: parseInt(p2.x / 32, 10),
    y: parseInt(p2.y / 32, 10),
  };

  const nearstVP2 = await get(`${vp2.x}-${vp2.y}`, true);
  if (nearstVP2) {
    vp2 = {
      x: nearstVP2.split(',')[0],
      y: nearstVP2.split(',')[1],
    };
  }

  const steps = await get(`${vp1.x}-${vp1.y}-${vp2.x}-${vp2.y}`);
  const realSteps = steps.map(step => ({
    x: step.split(',')[0] * 32,
    y: step.split(',')[1] * 32,
  })).slice(1);

  return nearstVP2
    ? realSteps
    : realSteps.slice(0, steps.length - 2).concat({ x: p2.x, y: p2.y });
};

// 计算A点距B点的方向
export const getDirection = (p1, p2) => {
  let degree = Math.atan((p2.y - p1.y) / (p2.x - p1.x)) * 180 / Math.PI;

  if (Math.abs(p2.y - p1.y) < 10e-6) {
    return p2.x > p1.x ? 'right' : 'left';
  }

  if (p2.y - p1.y > 0) {
    degree = degree < 0 ? 180 + degree : degree;
  } else {
    degree = degree < 0 ? 360 + degree : 180 + degree;
  }

  if (degree >= 337.5 || degree < 22.5) {
    return 'right';
  }

  if (degree >= 22.5 && degree < 67.5) {
    return 'rightTop';
  }

  if (degree >= 67.5 && degree < 112.5) {
    return 'top';
  }

  if (degree >= 112.5 && degree < 157.5) {
    return 'leftTop';
  }

  if (degree >= 157.5 && degree < 202.5) {
    return 'left';
  }

  if (degree >= 202.5 && degree < 247.5) {
    return 'leftBottom';
  }

  if (degree >= 247.5 && degree < 292.5) {
    return 'bottom';
  }

  return 'rightBottom';
};

// 计算A点距B点的角度
export const getDegree = (p1, p2) => {
  let degree = Math.atan((p2.y - p1.y) / (p2.x - p1.x)) * 180 / Math.PI;

  if (Math.abs(p2.y - p1.y) < 10e-6) {
    return p2.x > p1.x ? 'right' : 'left';
  }

  if (p2.y - p1.y > 0) {
    degree = degree < 0 ? 180 + degree : degree;
  } else {
    degree = degree < 0 ? 360 + degree : 180 + degree;
  }

  return degree;
};

// 线段是否与矩形相交
export const isLineIntersectRect = (p1, p2, r) => {
  const a = p1.y - p2.y;
  const b = p2.x - p1.x;
  const c = p1.x * p2.y - p2.x * p1.y;
  const rect = Object.assign({}, r, {
    leftTopX: r.x,
    leftTopY: r.y + r.height,
    rightBottomX: r.x + r.width,
    rightBottomY: r.y,
  });

  if (
    (
      a * rect.leftTopX + b * rect.leftTopY + c >= 0 &&
      a * rect.rightBottomX + b * rect.rightBottomY + c <= 0
    ) ||
    (
      a * rect.leftTopX + b * rect.leftTopY + c <= 0 &&
      a * rect.rightBottomX + b * rect.rightBottomY + c >= 0
    ) ||
    (
      a * rect.leftTopX + b * rect.rightBottomY + c >= 0 &&
      a * rect.rightBottomX + b * rect.leftTopY + c <= 0
    ) ||
    (
      a * rect.leftTopX + b * rect.rightBottomY + c <= 0 &&
      a * rect.rightBottomX + b * rect.leftTopY + c >= 0
    )
  ) {
    if (rect.leftTopX > rect.rightBottomX) {
      const temp = rect.leftTopX;
      rect.leftTopX = rect.rightBottomX;
      rect.rightBottomX = temp;
    }

    if (rect.leftTopY < rect.rightBottomY) {
      const temp = rect.leftTopY;
      rect.leftTopY = rect.rightBottomY;
      rect.rightBottomY = temp;
    }

    if (
      (p1.x < rect.leftTopX && p2.x < rect.leftTopX) ||
      (p1.x > rect.rightBottomX && p2.x > rect.rightBottomX) ||
      (p1.y > rect.leftTopY && p2.y > rect.leftTopY) ||
      (p1.y < rect.rightBottomY && p2.y < rect.rightBottomY)
    ) {
      return false;
    }

    return true;
  }

  return false;
};

// 计算两点之间的距离
export const getDistance = (p1, p2) => (
  Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2))
);

// 计算点到圆的最近可攻击点
export const getClosestPointForCircle = (p1, p2, radius) => {
  let xMin = parseInt((p2.x - radius) / 32, 10);
  let xMax = parseInt((p2.x + radius) / 32, 10);
  let yMin = parseInt((p2.y - radius) / 32, 10);
  let yMax = parseInt((p2.y + radius) / 32, 10);

  xMin = Math.max(0, xMin);
  xMin = Math.min(136, xMin);
  xMax = Math.max(0, xMax);
  xMax = Math.min(136, xMax);

  yMin = Math.max(0, yMin);
  yMin = Math.min(88, yMin);
  yMax = Math.max(0, yMax);
  yMax = Math.min(88, yMax);

  let minX;
  let minY;
  let minDistance;
  for (let x = xMin; x <= xMax; x++) {
    for (let y = yMin; y <= yMax; y++) {
      if (grids[x][y] === '.') {
        const distance = getDistance({ x: x * 32, y: y * 32 }, p2);
        if (distance <= radius) {
          const p1Distance = getDistance({ x: x * 32, y: y * 32 }, p1);
          if (!minX || !minY || p1Distance < minDistance) {
            minX = x;
            minY = y;
            minDistance = p1Distance;
          }
        }
      }
    }
  }

  return {
    x: minX * 32,
    y: minY * 32,
  };
};
