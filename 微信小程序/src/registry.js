'use strict';

/** One registration owns metadata and lazy construction. The host knows no IDs. */
function createRegistry(definitions) {
  if (!Array.isArray(definitions)) throw new TypeError('游戏目录必须为数组。');
  const byId = new Map();
  const entries = definitions.map(definition => {
    if (!definition || !/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(definition.id) || definition.id === 'home') {
      throw new TypeError('游戏 ID 必须为小写字母、数字及连字符，且不能为 home。');
    }
    if (byId.has(definition.id)) throw new TypeError(`游戏 ID 重复：${definition.id}`);
    if (typeof definition.title !== 'string' || !definition.title.trim()) throw new TypeError(`游戏 ${definition.id} 缺少标题。`);
    if (!['ready', 'soon'].includes(definition.status)) throw new TypeError(`游戏 ${definition.id} 的状态无效。`);
    if (definition.status === 'ready' && typeof definition.create !== 'function') throw new TypeError(`游戏 ${definition.id} 缺少创建工厂。`);
    if (definition.matchLegacyQuery !== undefined && typeof definition.matchLegacyQuery !== 'function') throw new TypeError('旧分享匹配器必须是函数。');
    const entry = Object.freeze({ subtitle: '', icon: 'play', ...definition });
    byId.set(entry.id, entry);
    return entry;
  });
  Object.freeze(entries);
  return Object.freeze({
    list: () => entries,
    get: id => typeof id === 'string' ? byId.get(id) || null : null,
    resolve(query = {}) {
      if (!query || typeof query !== 'object') return null;
      if (query.g) return typeof query.g === 'string' ? byId.get(query.g) || null : null;
      return entries.find(entry => entry.matchLegacyQuery && entry.matchLegacyQuery(query)) || null;
    },
  });
}

const registry = createRegistry([
  {
    id: 'sudoku', title: '数独', subtitle: '每一格，都有可能。', icon: 'grid', status: 'ready',
    create: context => require('./games/sudoku/index.js').createSudokuGame(context),
    matchLegacyQuery: query => typeof query.p === 'string' && Boolean(require('./games/sudoku/index.js').sharedRound(query)),
  },
  {
    id: 'gold-miner', title: '黄金矿工', subtitle: '瞄准快乐，满载而归。', icon: 'gold', theme: 'dark', status: 'ready',
    create: context => require('./games/gold-miner/index.js').createGoldMinerGame(context),
  },
  {
    id: 'zuma', title: 'Zuma', subtitle: '连起同色，消除烦恼。', icon: 'marbles', theme: 'dark', status: 'ready',
    create: context => require('./games/zuma/index.js').createZumaGame(context),
  },
  {
    id: 'game-2048', title: '2048', subtitle: '滑动合并，向 2048 出发。', icon: 'tiles', accent: '#786044', status: 'ready',
    create: context => require('./games/game-2048/index.js').createGame(context),
  },
  {
    id: 'minesweeper', title: '扫雷', subtitle: '步步推理，点亮安全。', icon: 'play', accent: '#42675a', status: 'ready',
    create: context => require('./games/minesweeper/index.js').createGame(context),
  },
  {
    id: 'gomoku', title: '五子棋', subtitle: '黑白之间，落子成趣。', icon: 'play', accent: '#82613e', status: 'ready',
    create: context => require('./games/gomoku/index.js').createGame(context),
  },
  {
    id: 'tetris', title: '俄罗斯方块', subtitle: '转动方块，消去烦恼。', icon: 'play', accent: '#426d70', status: 'ready',
    create: context => require('./games/tetris/index.js').createGame(context),
  },
  {
    id: 'huarongdao', title: '华容道', subtitle: '移步换位，巧解重围。', icon: 'play', accent: '#8b6548', status: 'ready',
    create: context => require('./games/huarongdao/index.js').createGame(context),
  },
]);

module.exports = { createRegistry, registry, GAMES: registry.list(), getGame: registry.get };
