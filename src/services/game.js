import uuid from 'uuid';
import { omit, cloneDeep } from 'lodash';
import schemas from 'schemas';
import { get, set } from 'common/redis';
import Exception from 'common/exception';
import {
  getDistance, getDirection,
  getMoveSteps, getClosestPointForCircle, getDegree,
} from 'common/utils';
import initTowers from 'init/towers';
import initHeros from 'init/heros';
import initHeroShooter from 'init/hero_shooter';
import { DISTANCE_DEVIATION } from 'common/constants';

// 游戏
class Game {
  // 构造函数
  constructor() {
    this.rooms = {};
    this.ais = {};
    this.states = {};
    this.locks = {};
    this.listeners = {};
  }

  // 初始化游戏
  async init(socket, params) {
    const { gameId } = params;
    const state = cloneDeep(schemas.state);

    // 只有管理员可以初始化比赛
    if (params.token !== 'imadminimadminimadmin') {
      throw new Exception('指令错误', '只有管理员可以初始化比赛');
    }

    // 计时器初始化
    clearInterval(this.listeners[gameId]);

    // 阵营初始化
    state.camps.blue = cloneDeep(schemas.camp);
    state.camps.red = cloneDeep(schemas.camp);

    // 资源塔初始化
    for (let i = 0; i < 6; i++) {
      let tower = cloneDeep(schemas.tower);
      tower.id = i;
      tower = Object.assign(
        {},
        tower,
        initTowers[i],
      );
      tower.initHealthPoint = tower.healthPoint;

      state.towers.push(tower);
    }

    // 进入英雄选择阶段
    state.status = 'picking';
    this.states[gameId] = cloneDeep(state);
    this.broadcast(gameId, 'picking');

    // 3秒钟后进入加载阶段
    setTimeout(async () => {
      // 随机选择英雄
      for (let i = 0; i < 10; i++) {
        if (!this.states[gameId].heros[i]) {
          let hero = cloneDeep(schemas.hero);
          hero.id = i;
          hero.camp = i < 5 ? 'blue' : 'red';
          hero.name = 'shooter';
          hero = Object.assign(
            {},
            hero,
            initHeroShooter,
            initHeros[i],
          );
          hero.initHealthPoint = hero.healthPoint;

          this.states[gameId].heros[i] = hero;
        }
      }

      this.states[gameId].status = 'loading';
      this.broadcast(gameId, 'loading', this.states[gameId]);
    }, 3000);

    // 5秒后正式开始游戏
    setTimeout(async () => {
      this.states[gameId].status = 'start';
      await set(`${gameId}.state`, this.states[gameId]);
      this.broadcast(gameId, 'start');
      console.log(`游戏【${gameId}】开始`);

      let runningGames = await get('runningGames');
      runningGames = runningGames || [];
      if (runningGames.indexOf(gameId) === -1) {
        runningGames.push(gameId);
      }
      await set('runningGames', runningGames);

      this.startLoop(gameId);
    }, 5000);
  }

  // 更新游戏状态
  async update(gameId) {
    // 检测是否可以触发此次流程
    if (this.locks[gameId]) {
      return;
    }
    this.locks[gameId] = true;

    // 数据初始化
    const delay = 40;
    const state = this.states[gameId];
    let update = {
      time: state.time + delay,
      camps: {
        blue: {},
        red: {},
      },
      towers: [],
      heros: [],
      bullets: {},
    };

    // 是否游戏结束
    if (state.time > 180 * 1000) {
      let runningGames = await get('runningGames');
      runningGames = runningGames || [];
      if (runningGames.indexOf(gameId) !== -1) {
        runningGames.splice(runningGames.indexOf(gameId), 1);
      }
      await set('runningGames', runningGames);
      this.broadcast(gameId, 'end');
      clearInterval(this.listeners[gameId]);
      console.log(`游戏【${gameId}】结束 - ${JSON.stringify(state.camps)}`);
    } else {
      // 更新
      update = await this.updateHeros(gameId, delay, state, update);
      update = await this.updateTowers(gameId, delay, state, update);
      update = await this.updateBullets(gameId, delay, state, update);

      // 执行更新
      Object.keys(update.camps).forEach((campId) => {
        const updateCamp = update.camps[campId];
        const camp = state.camps[campId];

        for (const key in updateCamp) {
          camp[key] += updateCamp[key];
        }
      });

      update.heros.forEach((updateHero) => {
        const hero = state.heros[updateHero.id];
        for (const key in updateHero) {
          hero[key] = updateHero[key];
        }
      });

      update.towers.forEach((updateTower) => {
        const tower = state.towers[updateTower.id];
        for (const key in updateTower) {
          tower[key] = updateTower[key];
        }
      });

      Object.keys(update.bullets).forEach((bulletId) => {
        const updateBullet = update.bullets[bulletId];
        const bullet = state.bullets[bulletId];

        if (bullet) {
          if (updateBullet.destroy) {
            delete state.bullets[bulletId];
          } else {
            for (const key in updateBullet) {
              bullet[key] = updateBullet[key];
            }
          }
        } else
        if (!updateBullet.destroy) {
          state.bullets[bulletId] = updateBullet;
        }
      });

      state.time = update.time;

      await set(`${gameId}.state`, state);
    }

    // 广播
    this.broadcast(gameId, 'update', {
      state: {
        id: state.id,
        time: state.time,
        camps: state.camps,
        towers: state.towers,
        heros: state.heros.map(hero => omit(hero, 'moveSteps')),
      },
    });
    this.broadcast(gameId, 'updatePlayer', {
      state: {
        id: state.id,
        time: state.time,
        camps: state.camps,
        towers: state.towers,
        heros: state.heros.map(hero => omit(hero, 'moveSteps')),
        bullets: state.bullets,
      },
    });

    // 解锁
    this.locks[gameId] = false;
  }

  // 更新英雄相关状态
  async updateHeros(gameId, delay, state, update) {
    const { heros, towers } = state;

    // 处理英雄相关更新
    for (let i = 0; i < heros.length; i++) {
      const {
        id, camp, cmd, executingCmd, status, moveSteps,
        position, moveSpeed, attackCD, fireCD, attackRange, fireRange,
        attackGap, fireGap, attackAnimation, fireAnimation,
        dazingRemaining, rebornRemaining, attackMissileSpeed, fireMissileSpeed,
        attackDamageMin, attackDamageMax, fireDamage, fireDuration,
        initHealthPoint, name,
      } = heros[i];
      const updateHero = { id };

      // 处理传送命令
      if (
        cmd.type === 'transmit' &&
        dazingRemaining === 0 &&
        rebornRemaining === 0
      ) {
        updateHero.position = { x: cmd.x, y: cmd.y };
        updateHero.cmd = {};
        updateHero.executingCmd = {};
      }

      // 处理停止命令
      if (
        cmd.type === 'stop' &&
        dazingRemaining === 0 &&
        rebornRemaining === 0
      ) {
        updateHero.status = 'stop';
        updateHero.cmd = {};
        updateHero.executingCmd = {};
      }

      // 处理位置
      if (status === 'moving') {
        let dest;
        let distance;
        let moveStepId = 0;

        while (moveStepId < moveSteps.length) {
          dest = {
            x: moveSteps[moveStepId].x,
            y: moveSteps[moveStepId].y,
          };
          distance = getDistance(position, dest);

          if (distance < DISTANCE_DEVIATION) {
            moveStepId++;
            updateHero.moveSteps = moveSteps.slice(moveStepId);
          } else {
            break;
          }
        }

        if (dest) {
          let hasSpeed = false;
          towers.forEach((tower) => {
            if (tower.camp === camp && tower.aura === 'speed') {
              hasSpeed = true;
            }
          });

          let realMoveSpeed = moveSpeed;
          if (hasSpeed) {
            realMoveSpeed *= 1.1;
          }

          const sinA = (dest.y - position.y) / distance;
          const cosA = (dest.x - position.x) / distance;
          updateHero.position = {
            x: position.x + cosA * realMoveSpeed * delay / 1000,
            y: position.y + sinA * realMoveSpeed * delay / 1000,
          };

          if (isNaN(updateHero.position.x) || isNaN(updateHero.position.y)) {
            updateHero.position = {
              x: heros[i].position.x,
              y: heros[i].position.y,
            };
          }

          updateHero.orientation = getDirection(position, dest);
        } else
        if (cmd.type === 'move') {
          updateHero.status = 'stop';
          updateHero.cmd = {};
          updateHero.executingCmd = {};
        }
      }

      // 处理移动命令
      if (
        cmd.type === 'move' && (
          (
            executingCmd.x !== cmd.x ||
            executingCmd.y !== cmd.y
          )
            &&
          (
            !executingCmd.lastTime ||
            new Date().getTime() - executingCmd.lastTime >= 480
          )
        ) &&
        dazingRemaining === 0 &&
        rebornRemaining === 0
      ) {
        updateHero.status = 'moving';
        updateHero.moveSteps = await getMoveSteps(position, cmd);
        updateHero.executingCmd = Object.assign({}, cmd, {
          lastTime: new Date().getTime(),
        });
      }

      // 处理攻击或者魔法命令
      if (
        (cmd.type === 'attack' || cmd.type === 'fire') &&
        dazingRemaining === 0 &&
        rebornRemaining === 0
      ) {
        const cd = cmd.type === 'attack' ? attackCD : fireCD;
        const range = cmd.type === 'attack' ? attackRange : fireRange;
        const animation = cmd.type === 'attack' ? attackAnimation : fireAnimation;
        const gap = cmd.type === 'attack' ? attackGap : fireGap;
        const speed = cmd.type === 'attack' ? attackMissileSpeed : fireMissileSpeed;

        const target =
          cmd.targetType === 'hero'
            ? heros[cmd.targetId]
            : towers[cmd.targetId];
        const distance = getDistance(position, target.position);

        if (
          (cmd.targetType === 'hero' && target.status === 'dead') ||
          target.camp === camp
        ) {
          updateHero.status = 'stop';
          updateHero.cmd = {};
          updateHero.executingCmd = {};
        } else
        if (distance < range + DISTANCE_DEVIATION) {
          if (cd === 0) {
            updateHero.status = cmd.type === 'attack' ? 'attacking' : 'firing';

            if (cmd.type === 'attack') {
              updateHero.attackCD = attackGap;
            } else {
              updateHero.fireCD = fireGap;
            }

            updateHero.executingCmd = cmd;
            updateHero.orientation = getDirection(position, target.position);
          } else
          if (gap - cd === animation) {
            // 生成子弹
            const bullet = {
              id: uuid.v1(),
              position: speed === 0 ? target.position : position,
              speed,
              type: (cmd.type === 'attack' ? 'attack' : 'fire') + (name === 'shooter' ? '0' : '1'),
              targetType: cmd.targetType,
              targetId: cmd.targetId,
              damage: cmd.type === 'attack'
                ? (
                  attackDamageMin +
                  parseInt((attackDamageMax - attackDamageMin) * Math.random(), 10)
                )
                : fireDamage,
              duration: cmd.type === 'attack' ? 0 : fireDuration,
              camp,
              degree: getDegree(position, target.position),
            };
            update.bullets[bullet.id] = bullet; // eslint-disable-line

            updateHero.status = cmd.type === 'attack' ? 'waitingAttack' : 'waitingFire';
            updateHero.executingCmd = cmd;
          }
        } else {
          const nearstPoint = getClosestPointForCircle(
            position,
            target.position,
            range,
          );

          if (
            (
              executingCmd.x !== nearstPoint.x ||
              executingCmd.y !== nearstPoint.y
            )
              &&
            (
              !executingCmd.lastTime ||
              new Date().getTime() - executingCmd.lastTime >= 480
            )
          ) {
            updateHero.status = 'moving';
            updateHero.moveSteps = await getMoveSteps(position, nearstPoint);
            updateHero.executingCmd = Object.assign({}, cmd, nearstPoint, {
              lastTime: new Date().getTime(),
            });
          }
        }
      }

      // 处理CD
      if (attackCD > 0) {
        updateHero.attackCD = Math.max(attackCD - delay, 0);
      }

      if (fireCD > 0) {
        updateHero.fireCD = Math.max(fireCD - delay, 0);
      }

      // 处理眩晕时间
      if (dazingRemaining > 0) {
        updateHero.dazingRemaining = Math.max(0, dazingRemaining - delay);
      }

      // 处理重生
      if (status === 'dead') {
        if (rebornRemaining === 0) {
          updateHero.position = Object.assign({}, initHeros[id].position);
          updateHero.orientation = 'bottom';
          updateHero.status = 'stop';
          updateHero.cmd = {};
          updateHero.executingCmd = {};
          updateHero.healthPoint = initHealthPoint;
          updateHero.moveSteps = [];
        } else {
          updateHero.rebornRemaining = Math.max(0, rebornRemaining - delay);
        }
      }

      // 更新
      update.heros.push(updateHero);
    }

    return update;
  }

  // 更新资源塔相关状态
  async updateTowers(gameId, delay, state, update) {
    const { towers } = state;

    // 处理塔相关更新
    for (let i = 0; i < towers.length; i++) {
      const { id, goldPerSecond, camp } = towers[i];
      const updateTower = { id };

      // 增加金钱
      if (camp && state.time % 1000 === 0) {
        update.camps[camp].goldCount =
          update.camps[camp].goldCount
            ? update.camps[camp].goldCount + goldPerSecond
            : goldPerSecond;
      }

      // 更新
      update.towers.push(updateTower);
    }

    return update;
  }

  // 更新子弹相关状态
  async updateBullets(gameId, delay, state, update) {
    const { camps, heros, towers, bullets } = state;

    // 处理子弹相关更新
    for (const i in bullets) {
      const {
        id, type, position, speed, targetType,
        targetId, camp, damage, duration,
      } = bullets[i];
      const updateBullet = { id };

      const target =
        targetType === 'hero'
          ? heros[targetId]
          : towers[targetId];
      const distance = getDistance(position, target.position);

      if (distance < DISTANCE_DEVIATION) {
        let realDamage = damage;

        if (type === 'attack0' || type === 'attack1') {
          let hasPhysics = false;
          towers.forEach((tower) => {
            if (tower.camp === camp && tower.aura === 'physics') {
              hasPhysics = true;
            }
          });

          if (hasPhysics) {
            realDamage *= 0.9;
          }
        }

        if (type === 'fire0' || type === 'fire1') {
          let hasMagic = false;
          towers.forEach((tower) => {
            if (tower.camp === camp && tower.aura === 'magic') {
              hasMagic = true;
            }
          });

          if (hasMagic) {
            realDamage *= 0.9;
          }
        }

        let realHealthPoint = target.healthPoint;
        if (
          targetType === 'hero' &&
          update.heros[target.id].healthPoint !== undefined
        ) {
          realHealthPoint = update.heros[target.id].healthPoint;
        }

        if (
          targetType === 'tower' &&
          update.towers[target.id].healthPoint !== undefined
        ) {
          realHealthPoint = update.towers[target.id].healthPoint;
        }

        const healthPoint = Math.max(
          0,
          realHealthPoint - realDamage,
        );

        if (target.type === 'hero') {
          if (target.status !== 'dead') {
            update.heros[target.id].healthPoint = healthPoint;

            if (duration) {
              update.heros[target.id].status = 'dazing';
              update.heros[target.id].dazingRemaining = duration;
            }

            if (healthPoint === 0 && update.heros[target.id].status !== 'dead') {
              update.heros[target.id].status = 'dead';
              update.heros[target.id].rebornRemaining = 15000;
              update.camps[camp].killCount =
                update.camps[camp].killCount ? update.camps[camp].killCount + 1 : 1;
              updateBullet.isFirstBlood = (camps.red.killCount + camps.blue.killCount + update.camps[camp].killCount + (update.camps[camp === 'red' ? 'blue' : 'red'].killCount || 0)) === 1;
            }
          }
        } else
        if (
          target.camp !== camp &&
          update.towers[target.id].camp !== camp
        ) {
          update.towers[target.id].healthPoint = healthPoint;

          if (healthPoint === 0) {
            update.towers[target.id].healthPoint = target.initHealthPoint;
            update.towers[target.id].camp = camp;

            update.camps[camp].towerCount =
              update.camps[camp].towerCount ? update.camps[camp].towerCount + 1 : 1;

            if (state.towers[target.id].camp) {
              update.camps[camp === 'red' ? 'blue' : 'red'].towerCount =
                update.camps[camp === 'red' ? 'blue' : 'red'].towerCount
                  ? update.camps[camp === 'red' ? 'blue' : 'red'].towerCount - 1
                  : -1;
            }
          }
        }

        if (!updateBullet.isFirstBlood) {
          updateBullet.destroy = true;
        }
      } else {
        const sinA = (target.position.y - position.y) / distance;
        const cosA = (target.position.x - position.x) / distance;
        updateBullet.position = {
          x: position.x + cosA * speed * delay / 1000,
          y: position.y + sinA * speed * delay / 1000,
          degree: getDegree(position, target.position),
        };
      }

      // 更新
      update.bullets[updateBullet.id] = updateBullet;
    }

    return update;
  }

  // 广播消息
  async broadcast(gameId, eventName, data) {
    if (this.rooms[gameId]) {
      this.rooms[gameId].forEach((socket) => {
        if (eventName === 'updatePlayer' && socket.camp) {
          return;
        }

        if (eventName === 'update' && !socket.camp) {
          return;
        }

        try {
          socket.send(JSON.stringify(Object.assign(
            {},
            {
              type: eventName,
              myCamp: socket.camp,
            },
            data,
          )));
        } catch (e) {
          // eslint-disable-line
        }
      });

      if (gameId.split('v').indexOf('00') !== -1) {
        try {
          this.ais['00'].send(JSON.stringify(Object.assign(
            {},
            {
              type: eventName,
              gameId,
              myCamp: 'red',
            },
            data,
          )));
        } catch (e) {
          // eslint-disable-line
        }
      }

      if (gameId.split('v').indexOf('01') !== -1) {
        try {
          this.ais['01'].send(JSON.stringify(Object.assign(
            {},
            {
              type: eventName,
              gameId,
              myCamp: 'red',
            },
            data,
          )));
        } catch (e) {
          // eslint-disable-line
        }
      }
    }
  }

  // 启动轮询
  async startLoop(gameId) {
    clearInterval(this.listeners[gameId]);

    this.listeners[gameId] = setInterval(async () => {
      try {
        await this.update(gameId);
      } catch (e) {
        console.log(e);
      }
    }, 40);
  }

  // 恢复游戏
  async resume() {
    let runningGames = await get('runningGames');
    runningGames = runningGames || [];
    for (let i = 0; i < runningGames.length; i++) {
      const gameId = runningGames[i];
      const state = await get(`${gameId}.state`);
      if (state) {
        this.states[gameId] = state;
        this.startLoop(gameId);
      }
    }
  }

  // 删除无效的socket
  async clean() {
    setInterval(() => {
      Object.keys(this.rooms).forEach((key) => {
        const newSockets = [];
        this.rooms[key].forEach((socket) => {
          try {
            socket.send(JSON.stringify({ type: 'ping' }));
          } catch (e) {
            socket.terminate();
            return;
          }

          newSockets.push(socket);
        });
        this.rooms[key] = newSockets;
      });
    }, 60 * 1000);
  }
}

// 导出
export default new Game();
