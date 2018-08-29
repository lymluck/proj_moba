import uuid from 'uuid';
import { cloneDeep } from 'lodash';
import schemas from 'schemas';
import Exception from 'common/exception';
import teams from 'common/teams';
import initHeros from 'init/heros';
import initHeroShooter from 'init/hero_shooter';
import initHeroWarrior from 'init/hero_warrior';
import game from 'services/game';

// 用户
class User {
  // 加入房间
  async join(socket, params) {
    const { gameId, token, isRed } = params;

    // 判断是否属于某一个队伍
    let team;
    teams.forEach((theTeam) => {
      if (theTeam.token === token) {
        team = theTeam;
      }
    });

    if (team && gameId && gameId.split('v').indexOf(team.id) !== -1) {
      // 从之前的房间中删除
      if (socket.gameId && game.rooms[socket.gameId]) {
        game.rooms[socket.gameId].splice(
          game.rooms[socket.gameId].indexOf(socket.gameId),
          1,
        );
      }

      if (gameId.split('v')[0] === team.id) {
        socket.camp = 'blue';
      } else {
        socket.camp = 'red';
      }

      if (gameId.split('v')[0] === gameId.split('v')[1] && isRed) {
        socket.camp = 'red';
      }

      if (gameId.split('v').indexOf('00') !== -1) {
        socket.camp = 'blue';
      }
    }

    // 加入房间
    game.rooms[gameId] = game.rooms[gameId] || [];
    game.rooms[gameId].push(socket);
    socket.gameId = gameId;
    socket.teamId = team ? team.id : undefined;
  }

  // ai加入房间
  async aiJoin(socket, params) {
    const { id, token } = params;

    if (token !== 'imaiimaiimai') {
      throw new Exception('指令错误', '你没有权限在本房间进行操作');
    }

    game.ais[id] = socket;
    socket.gameId = 'ai';
    socket.teamId = 'ai';
    socket.camp = 'red';
  }

  // 选择英雄
  async pickHero(socket, params) {
    const { teamId, camp } = socket;
    const gameId = teamId === 'ai' ? params.gameId : socket.gameId;
    const { heros } = params;
    const state = game.states[gameId];

    if (
      teamId !== 'ai' && (
        gameId.split('v').indexOf(teamId) === -1 || !socket.camp
      )
    ) {
      throw new Exception('指令错误', '你没有权限在本房间进行操作');
    }

    if (state.status !== 'picking') {
      throw new Exception('指令错误', '当前不处于选择英雄阶段');
    }

    if (!(heros instanceof Array) || heros.length !== 5) {
      throw new Exception('指令错误', '所传参数必须包含5个英雄名称的数组');
    }

    let cntId = camp === 'blue' ? 0 : 5;
    params.heros.forEach((heroName) => {
      let hero = cloneDeep(schemas.hero);
      hero.id = cntId;
      hero.camp = camp;
      hero.name = heroName;
      hero = Object.assign(
        {},
        hero,
        heroName === 'shooter' ? initHeroShooter : initHeroWarrior,
        initHeros[cntId],
      );
      hero.initHealthPoint = hero.healthPoint;

      state.heros[cntId] = hero;
      cntId++;
    });
  }

  // 执行传送指令
  async transmit(io, socket, params) {
    const { teamId, camp } = socket;
    const gameId = teamId === 'ai' ? params.gameId : socket.gameId;
    const { heroId, x, y } = params;
    const state = game.states[gameId];

    if (true) {
      throw new Exception('指令错误', '正式比赛不能使用传送指令');
    }

    if (!state) {
      throw new Exception('指令错误', '房间不存在');
    }

    const hero = state.heros[heroId];

    if (
      teamId !== 'ai' && (
        gameId.split('v').indexOf(teamId) === -1 || !socket.camp
      )
    ) {
      throw new Exception('指令错误', '你没有权限在本房间进行操作');
    }

    if (
      (camp === 'blue' && heroId >= 5) ||
      (camp === 'red' && heroId < 5)
    ) {
      throw new Exception('指令错误', '不能操作对方英雄');
    }

    if (!hero || isNaN(parseInt(heroId, 10)) || heroId < 0 || heroId > 9) {
      throw new Exception('指令错误', '英雄不存在');
    }

    if (
      isNaN(parseInt(x, 10)) ||
      isNaN(parseInt(y, 10)) ||
      x < 0 ||
      y < 0 ||
      x >= 4352 ||
      y >= 2816
    ) {
      throw new Exception('指令错误', '坐标越界');
    }

    if (['attacking', 'firing', 'dead'].indexOf(hero.status) !== -1) {
      return;
    }

    hero.cmd = {
      id: uuid.v1(),
      type: 'transmit',
      x,
      y,
    };
  }

  // 执行移动指令
  async move(socket, params) {
    const { teamId, camp } = socket;
    const gameId = teamId === 'ai' ? params.gameId : socket.gameId;
    const { heroId, x, y } = params;
    const state = game.states[gameId];

    if (!state) {
      throw new Exception('指令错误', '房间不存在');
    }

    const hero = state.heros[heroId];

    if (
      teamId !== 'ai' && (
        gameId.split('v').indexOf(teamId) === -1 || !socket.camp
      )
    ) {
      throw new Exception('指令错误', '你没有权限在本房间进行操作');
    }

    if (
      (camp === 'blue' && heroId >= 5) ||
      (camp === 'red' && heroId < 5)
    ) {
      throw new Exception('指令错误', '不能操作对方英雄');
    }

    if (!hero || isNaN(parseInt(heroId, 10)) || heroId < 0 || heroId > 9) {
      throw new Exception('指令错误', '英雄不存在');
    }

    if (
      isNaN(parseInt(x, 10)) ||
      isNaN(parseInt(y, 10)) ||
      x < 0 ||
      y < 0 ||
      x >= 4352 ||
      y >= 2816
    ) {
      throw new Exception('指令错误', '坐标越界');
    }

    if (['attacking', 'firing', 'dead'].indexOf(hero.status) !== -1) {
      return;
    }

    hero.cmd = {
      id: uuid.v1(),
      type: 'move',
      x,
      y,
    };
  }

  // 执行停止指令
  async stop(socket, params) {
    const { teamId, camp } = socket;
    const gameId = teamId === 'ai' ? params.gameId : socket.gameId;
    const { heroId } = params;
    const state = game.states[gameId];

    if (!state) {
      throw new Exception('指令错误', '房间不存在');
    }

    const hero = state.heros[heroId];

    if (
      teamId !== 'ai' && (
        gameId.split('v').indexOf(teamId) === -1 || !socket.camp
      )
    ) {
      throw new Exception('指令错误', '你没有权限在本房间进行操作');
    }

    if (
      (camp === 'blue' && heroId >= 5) ||
      (camp === 'red' && heroId < 5)
    ) {
      throw new Exception('指令错误', '不能操作对方英雄');
    }

    if (!hero || isNaN(parseInt(heroId, 10)) || heroId < 0 || heroId > 9) {
      throw new Exception('指令错误', '英雄不存在');
    }

    if (['attacking', 'firing', 'dead'].indexOf(hero.status) !== -1) {
      return;
    }

    hero.cmd = {
      id: uuid.v1(),
      type: 'stop',
    };
  }

  // 执行攻击指令
  async attack(socket, params) {
    const { teamId, camp } = socket;
    const gameId = teamId === 'ai' ? params.gameId : socket.gameId;
    const { heroId, targetType, targetId } = params;
    const state = game.states[gameId];

    if (!state) {
      throw new Exception('指令错误', '房间不存在');
    }

    const hero = state.heros[heroId];

    if (
      teamId !== 'ai' && (
        gameId.split('v').indexOf(teamId) === -1 || !socket.camp
      )
    ) {
      throw new Exception('指令错误', '你没有权限在本房间进行操作');
    }

    if (
      (camp === 'blue' && heroId >= 5) ||
      (camp === 'red' && heroId < 5)
    ) {
      throw new Exception('指令错误', '不能操作对方英雄');
    }

    if (!hero || isNaN(parseInt(heroId, 10)) || heroId < 0 || heroId > 9) {
      throw new Exception('指令错误', '英雄不存在');
    }

    if (targetType !== 'hero' && targetType !== 'tower') {
      throw new Exception('指令错误', '目标类型错误');
    }

    if (targetType === 'hero' && (isNaN(parseInt(targetId, 10)) || targetId < 0 || targetId > 9)) {
      throw new Exception('指令错误', '目标英雄不存在错误');
    }

    if (targetType === 'tower' && (isNaN(parseInt(targetId, 10)) || targetId < 0 || targetId > 5)) {
      throw new Exception('指令错误', '目标塔不存在错误');
    }

    if (['attacking', 'firing', 'dead'].indexOf(hero.status) !== -1) {
      return;
    }

    hero.cmd = {
      id: uuid.v1(),
      type: 'attack',
      targetType,
      targetId,
    };
  }

  // 执行施放技能指令
  async fire(socket, params) {
    const { teamId, camp } = socket;
    const gameId = teamId === 'ai' ? params.gameId : socket.gameId;
    const { heroId, targetId } = params;
    const state = game.states[gameId];

    if (!state) {
      throw new Exception('指令错误', '房间不存在');
    }

    const hero = state.heros[heroId];

    if (
      teamId !== 'ai' && (
        gameId.split('v').indexOf(teamId) === -1 || !socket.camp
      )
    ) {
      throw new Exception('指令错误', '你没有权限在本房间进行操作');
    }

    if (
      (camp === 'blue' && heroId >= 5) ||
      (camp === 'red' && heroId < 5)
    ) {
      throw new Exception('指令错误', '不能操作对方英雄');
    }

    if (!hero || isNaN(parseInt(heroId, 10)) || heroId < 0 || heroId > 9) {
      throw new Exception('指令错误', '英雄不存在');
    }

    if (isNaN(parseInt(targetId, 10)) || targetId < 0 || targetId > 9) {
      throw new Exception('指令错误', '目标英雄不存在错误');
    }

    if (['attacking', 'firing', 'dead'].indexOf(hero.status) !== -1) {
      return;
    }

    hero.cmd = {
      id: uuid.v1(),
      type: 'fire',
      targetType: 'hero',
      targetId,
    };
  }
}

// 导出
export default new User();
