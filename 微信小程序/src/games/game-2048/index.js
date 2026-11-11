'use strict';

const { saveKey } = require('../../platform/storage.js');
const { newGame, applyMove, canMove, maxTile, cloneRound, validateRound } = require('./engine.js');
const { createLayout, renderGame } = require('./renderer.js');

const ID = 'game-2048';
const SAVE_KEY = saveKey(ID);
const ANIMATION_MS = 130;
const DIRECTIONS = ['up', 'down', 'left', 'right'];

/** The host supplies platform services; this module owns only its own round. */
function createGame({ read = () => null, write = () => false, now = Date.now, services = {} } = {}) {
  let saved = null;
  try { saved = read(SAVE_KEY); } catch {}
  const restored = saved && saved.version === 1 ? validateRound(saved.round) : null;
  let seedCounter = 0;
  const seed = () => (Number(now()) >>> 0) ^ (++seedCounter * 2654435761);
  let round = restored || newGame(seed());
  let best = Math.max(round.score, saved && Number.isSafeInteger(saved.best) && saved.best >= 0 ? saved.best : 0);
  let paused = Boolean(restored);
  let animation = null;
  let layout = createLayout({ width: 375, height: 667, safeTop: 24, safeBottom: 0 });
  let gesture = null;
  const pointers = new Set();
  let generation = 0;
  let disposed = false;
  let storageOK = true;

  const status = () => round.won && !round.keepPlaying ? 'won' : canMove(round.board) ? 'playing' : 'over';
  const invalidate = () => { if (services.invalidate) services.invalidate(); };
  function clearGesture() { gesture = null; pointers.clear(); }
  function save() {
    try { storageOK = write(SAVE_KEY, { version: 1, round: cloneRound(round), best }) !== false; }
    catch { storageOK = false; }
    return storageOK;
  }
  function pause() {
    generation += 1;
    paused = true;
    animation = null;
    clearGesture();
  }
  function startNew() {
    generation += 1;
    round = newGame(seed());
    paused = false; animation = null; clearGesture();
    save(); invalidate();
    return true;
  }
  function move(direction) {
    if (disposed || paused || animation || status() !== 'playing' || !DIRECTIONS.includes(direction)) return false;
    const result = applyMove(round, direction);
    if (!result.changed) return false;
    round = result.round;
    best = Math.max(best, round.score);
    animation = { transitions: result.transitions, spawned: result.spawned,
      mergedIndices: result.mergedIndices, elapsed: 0, duration: ANIMATION_MS };
    save();
    return true;
  }
  function activate(action, payload) {
    if (disposed) return false;
    if (action === `${ID}:move`) { clearGesture(); return move(payload); }
    if (action === `${ID}:pause` && !paused && status() === 'playing') { pause(); return true; }
    if (action === `${ID}:resume` && paused && status() === 'playing') {
      generation += 1; clearGesture(); paused = false; return true;
    }
    if (action === `${ID}:continue` && status() === 'won') {
      generation += 1; clearGesture(); round.keepPlaying = true; paused = false; animation = null; save(); return true;
    }
    if (action === `${ID}:new`) {
      if (round.moves > 0 && status() === 'playing') {
        pause();
        const expectedGeneration = generation;
        if (!services.modal) { if (services.toast) services.toast('暂时无法确认重开，请稍后再试'); return true; }
        services.modal({ title: '重新开始 2048？', content: '当前棋盘将被替换，最佳成绩会保留。',
          confirmText: '重新开始', cancelText: '保留进度' }, () => {
          if (!disposed && generation === expectedGeneration) startNew();
        });
        return true;
      }
      return startNew();
    }
    if (action === `${ID}:help`) {
      pause();
      if (services.modal) services.modal({ title: '2048 · 玩法',
        content: '在棋盘上向上、下、左、右滑动，或点击方向按钮。相同数字相遇会合并，每块在一次移动中只合并一次。\n\n有效移动后随机出现一块 2（90%）或 4（10%）；无效滑动不生成数字。合并后的数字计入分数。\n\n合成 2048 即达成目标，可以继续挑战更大数字；棋盘填满且无法合并时结束。\n\n棋盘与最佳成绩自动保存在本机。返回后点“继续游戏”恢复。',
        showCancel: false, confirmText: '知道了' });
      return true;
    }
    return false;
  }

  const pointId = point => point.identifier === undefined ? (point.id === undefined ? 0 : point.id) : point.identifier;
  const coordinate = point => ({ x: Number(point.clientX === undefined ? point.x : point.clientX),
    y: Number(point.clientY === undefined ? point.y : point.clientY) });
  const inside = (point, area) => point.x >= area.x && point.x <= area.x + area.w && point.y >= area.y && point.y <= area.y + area.h;
  function pointer(type, points = []) {
    if (disposed) return false;
    if (type === 'cancel') { const had = Boolean(gesture); clearGesture(); return had; }
    if (paused || animation || status() !== 'playing') { clearGesture(); return false; }
    const list = Array.isArray(points) ? points.filter(point => point && typeof point === 'object') : [];
    if (type === 'start') {
      for (const point of list) pointers.add(pointId(point));
      if (list.length !== 1 || pointers.size !== 1 || gesture) { gesture = null; return false; }
      const p = coordinate(list[0]);
      if (!Number.isFinite(p.x) || !Number.isFinite(p.y) || !inside(p, layout.board)) return false;
      gesture = { id: pointId(list[0]), x: p.x, y: p.y };
      return true;
    }
    const point = gesture && list.find(item => pointId(item) === gesture.id);
    if (type === 'end') {
      for (const item of list) pointers.delete(pointId(item));
      const start = gesture;
      gesture = null;
      if (!start || !point || list.length !== 1 || pointers.size) return false;
      const end = coordinate(point), dx = end.x - start.x, dy = end.y - start.y;
      const ax = Math.abs(dx), ay = Math.abs(dy);
      if (!Number.isFinite(ax) || !Number.isFinite(ay) || Math.max(ax, ay) < 18 || Math.max(ax, ay) < Math.min(ax, ay) * 1.2) return false;
      return move(ax > ay ? dx > 0 ? 'right' : 'left' : dy > 0 ? 'down' : 'up');
    }
    if (type === 'move') {
      if (list.length > 1 || (list.length && !point)) { gesture = null; return false; }
      return Boolean(gesture);
    }
    return false;
  }

  return {
    id: ID, frameInterval: 16,
    enter() { generation += 1; clearGesture(); },
    resize(viewport) { animation = null; clearGesture(); layout = createLayout(viewport); },
    render(ctx) { return renderGame(ctx, layout, { round, best, paused, status: status(), animation,
      storageAvailable: storageOK && services.storageAvailable !== false }); },
    tick(deltaMs) {
      if (disposed || paused || !animation || !Number.isFinite(deltaMs) || deltaMs <= 0) return;
      animation.elapsed += Math.min(deltaMs, 200);
      if (animation.elapsed >= animation.duration) animation = null;
    },
    activate, pointer, pause, save,
    sharePayload() { return { title: '一起来合成 2048 · 花自飘零的游戏空间', query: `g=${ID}` }; },
    getResumeInfo() { return { text: `${round.score} 分 · 最大方块 ${maxTile(round.board)}`, available: round.moves > 0 }; },
    get model() { return { round, best, paused, status: status(), animation }; },
    get layout() { return layout; },
    get musicActive() { return !disposed && !paused && status() === 'playing'; },
    get statusText() { return `2048 · ${round.score} 分 · 最大 ${maxTile(round.board)} · ${status() === 'won' ? '已合成 2048' : status() === 'over' ? '本局结束' : paused ? '已暂停' : '滑动合并'}`; },
    dispose() { pause(); disposed = true; },
  };
}

module.exports = { createGame, SAVE_KEY, ANIMATION_MS };
