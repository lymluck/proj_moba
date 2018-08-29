export default {
  // 编号
  id: 0,
  // 类型
  type: 'hero',
  // 所属阵营
  camp: '',
  // 英雄名称
  name: '',
  // 移动速度
  moveSpeed: 0,
  // 攻击最大伤害
  attackDamageMin: 0,
  // 攻击最小伤害
  attackDamageMax: 0,
  // 攻击范围
  attackRange: 0,
  // 攻击动画持续时间
  attackAnimation: 0,
  // 攻击间隔
  attackGap: 0,
  // 攻击弹道速度
  attackMissileSpeed: 0,
  // 魔法名称
  fireName: '',
  // 魔法伤害
  fireDamage: 0,
  // 魔法持续时间
  fireDuration: 0,
  // 魔法施放范围
  fireRange: 0,
  // 魔法动画持续时间
  fireAnimation: 0,
  // 魔法施放间隔
  fireGap: 0,
  // 魔法弹道速度
  fireMissileSpeed: 0,

  // 可变参数 =================================================

  // 位置
  position: {
    x: 0,
    y: 0,
  },
  // 朝向
  orientation: 'bottom',
  // 当前状态
  status: 'stop',
  // 期望执行的命令
  cmd: {},
  // 正在执行的命令
  executingCmd: {},
  // 血量
  healthPoint: 1000,
  // 攻击冷却时间
  attackCD: 0,
  // 魔法冷却时间
  fireCD: 0,
  // 眩晕剩余时间
  dazingRemaining: 0,
  // 重生剩余时间
  rebornRemaining: 0,
  // 移动步骤
  moveSteps: [],
};
