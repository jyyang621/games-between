'use strict';

const REQUIRED_METHODS = Object.freeze(['resize', 'render', 'tick', 'activate', 'pointer', 'pause', 'save', 'enter', 'sharePayload', 'getResumeInfo']);

function validateGameModule(game, id) {
  if (!game || game.id !== id) throw new TypeError(`游戏模块 ID 与注册项不一致：${id}`);
  for (const method of REQUIRED_METHODS) {
    if (typeof game[method] !== 'function') throw new TypeError(`游戏 ${id} 缺少 ${method}() 接口。`);
  }
  if (!Number.isFinite(game.frameInterval) || game.frameInterval <= 0) throw new TypeError(`游戏 ${id} 需要合法的 frameInterval。`);
  if (typeof game.statusText !== 'string') throw new TypeError(`游戏 ${id} 需要 statusText。`);
  if (!game.model || typeof game.model !== 'object') throw new TypeError(`游戏 ${id} 需要独立 model。`);
  const resume = game.getResumeInfo();
  if (!resume || typeof resume.text !== 'string' || typeof resume.available !== 'boolean') {
    throw new TypeError(`游戏 ${id} 的 getResumeInfo() 应返回 text 和 available。`);
  }
  return game;
}

module.exports = { REQUIRED_METHODS, validateGameModule };
