'use strict';

const { saveKey } = require('../../platform/storage.js');
const { newRound, move, rotate, dropDistance, lockPiece, hardDrop, cloneRound, validateRound } = require('./engine.js');
const { createLayout, renderGame } = require('./renderer.js');
const ID = 'tetris';
const SAVE_KEY = saveKey(ID);
const LOCK_DELAY = 500;
const MAX_LOCK_RESETS = 15;
const MAX_FRAME = 100;
const gravityInterval = level => Math.max(80, Math.round(800 * Math.pow(0.82, level - 1)));

function createGame({ read = () => null, write = () => false, now = Date.now, services = {} } = {}) {
  let saved;
  try { saved = read(SAVE_KEY); } catch {}
  const restored = saved && saved.version === 1 ? validateRound(saved.round) : null;
  let sequence = 0;
  const seed = () => ((Number(now()) >>> 0) ^ Math.imul(++sequence, 2654435761)) >>> 0;
  let round = restored || newRound(seed());
  let best = Math.max(round.score, saved && Number.isSafeInteger(saved.best) && saved.best >= 0 ? saved.best : 0);
  let paused = Boolean(restored);
  let disposed = false, generation = 0, storageOK = true;
  let fallMs = 0, lockMs = 0, lockResets = 0, saveMs = 0, lastClear = 0, clearMs = 0;
  if (restored && saved.timing) {
    const t = saved.timing;
    if (Number.isFinite(t.fallMs) && t.fallMs >= 0 && t.fallMs < gravityInterval(round.level)) fallMs = t.fallMs;
    if (Number.isFinite(t.lockMs) && t.lockMs >= 0 && t.lockMs <= LOCK_DELAY) lockMs = t.lockMs;
    if (Number.isInteger(t.lockResets) && t.lockResets >= 0 && t.lockResets <= MAX_LOCK_RESETS) lockResets = t.lockResets;
  }
  let layout = createLayout({ width: 375, height: 667, safeTop: 24, safeBottom: 0 });
  let gesture = null;
  const pointers = new Set();
  const playing = () => !disposed && !paused && round.status === 'playing';
  const invalidate = () => { if (services.invalidate) services.invalidate(); };
  const clearGesture = () => { gesture = null; pointers.clear(); };
  function save() {
    best = Math.max(best, round.score);
    try { storageOK = write(SAVE_KEY, { version: 1, round: cloneRound(round), best,
      timing: { fallMs, lockMs, lockResets } }) !== false; } catch { storageOK = false; }
    saveMs = 0;
    return storageOK;
  }
  function pause() { generation += 1; paused = true; clearGesture(); save(); }
  function finishLock(result) {
    if (!result.locked) return false;
    fallMs = 0; lockMs = 0; lockResets = 0;
    lastClear = result.lines; clearMs = lastClear ? 1000 : 0;
    clearGesture(); save();
    return true;
  }
  function act(name) {
    if (!playing()) return false;
    if (name === 'hard-drop') return finishLock(hardDrop(round));
    const grounded = dropDistance(round) === 0;
    let changed = false;
    if (name === 'left' || name === 'right') changed = move(round, name === 'left' ? -1 : 1, 0);
    else if (name === 'rotate') changed = rotate(round, 1);
    else if (name === 'soft-drop') {
      changed = move(round, 0, 1);
      if (changed) {
        round.score = Math.min(Number.MAX_SAFE_INTEGER, round.score + 1); best = Math.max(best, round.score); fallMs = 0;
        if (lockResets < MAX_LOCK_RESETS) lockMs = 0;
      }
    }
    if (changed && grounded && name !== 'soft-drop' && lockResets < MAX_LOCK_RESETS) {
      lockMs = 0; lockResets += 1;
    }
    return changed;
  }
  function startNew() {
    generation += 1; round = newRound(seed()); paused = false;
    fallMs = 0; lockMs = 0; lockResets = 0; lastClear = 0; clearMs = 0;
    clearGesture(); save(); invalidate(); return true;
  }
  function activate(action) {
    if (disposed || typeof action !== 'string' || !action.startsWith(`${ID}:`)) return false;
    const name = action.slice(ID.length + 1);
    if (['left', 'right', 'rotate', 'soft-drop', 'hard-drop'].includes(name)) { clearGesture(); return act(name); }
    if (name === 'pause' && playing()) { pause(); return true; }
    if (name === 'resume' && paused && round.status === 'playing') {
      generation += 1; clearGesture(); paused = false; return true;
    }
    if (name === 'new') {
      if (round.status === 'playing') {
        pause(); const expected = generation;
        if (!services.modal) { if (services.toast) services.toast('暂时无法确认重开，请稍后再试'); return true; }
        services.modal({ title: '重新开始俄罗斯方块？', content: '当前棋盘将被替换，本机最佳分数会保留。',
          confirmText: '重新开始', cancelText: '保留进度' }, () => {
          if (!disposed && generation === expected) startNew();
        });
        return true;
      }
      return startNew();
    }
    if (name === 'help') {
      pause();
      if (services.modal) services.modal({ title: '俄罗斯方块 · 玩法',
        content: '用左右按钮移动，旋转按钮顺时针转动；下移每次下降一格，直落立即落到底部并锁定。也可在棋盘点按旋转、左右滑动移动、下滑逐格下降。\n\n填满一整行即可消除。消除1/2/3/4行分别获得100/300/500/800分，再乘当前等级；手动下移每格1分，直落每格2分。每消除10行升一级，最高20级。\n\n七种方块每袋各出现一次；浅色轮廓表示落点，右侧预告下三块。触底后有0.5秒调整时间，每块最多重置15次。堆到顶部无法放入新方块即结束。\n\n进度自动保存在本机，返回后手动继续。',
        showCancel: false, confirmText: '知道了' });
      return true;
    }
    return false;
  }
  const pointId = p => p.identifier === undefined ? (p.id === undefined ? 0 : p.id) : p.identifier;
  const position = p => ({ x: Number(p.clientX === undefined ? p.x : p.clientX), y: Number(p.clientY === undefined ? p.y : p.clientY) });
  function pointer(type, points = []) {
    if (disposed) return false;
    if (type === 'cancel') { const had = Boolean(gesture); clearGesture(); return had; }
    if (!playing()) { clearGesture(); return false; }
    const list = Array.isArray(points) ? points.filter(p => p && typeof p === 'object') : [];
    if (type === 'start') {
      for (const p of list) pointers.add(pointId(p));
      if (list.length !== 1 || pointers.size !== 1 || gesture) { gesture = null; return false; }
      const p = position(list[0]), b = layout.board;
      if (!Number.isFinite(p.x) || !Number.isFinite(p.y) || p.x < b.x || p.x > b.x + b.w || p.y < b.y || p.y > b.y + b.h) return false;
      gesture = { id: pointId(list[0]), x: p.x, y: p.y, dragged: false, changed: false };
      return true;
    }
    const tracked = gesture && list.find(p => pointId(p) === gesture.id);
    if (type === 'move' || type === 'end') {
      const current = gesture;
      if (type === 'end') for (const p of list) pointers.delete(pointId(p));
      if (!current || !tracked || list.length !== 1 || (type === 'end' && pointers.size)) { gesture = null; return false; }
      const p = position(tracked);
      if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) { clearGesture(); return false; }
      const step = Math.max(12, layout.board.w / 10), dx = p.x - current.x, dy = p.y - current.y;
      if (Math.max(Math.abs(dx), Math.abs(dy)) >= step) {
        current.dragged = true;
        if (Math.abs(dx) >= Math.abs(dy)) {
          const count = Math.min(10, Math.floor(Math.abs(dx) / step));
          for (let i = 0; i < count; i += 1) current.changed = act(dx > 0 ? 'right' : 'left') || current.changed;
          current.x = p.x; current.y = p.y;
        } else {
          if (dy > 0) for (let i = 0; i < Math.min(20, Math.floor(dy / step)); i += 1) current.changed = act('soft-drop') || current.changed;
          current.x = p.x; current.y = p.y;
        }
      }
      if (type === 'end') {
        gesture = null;
        if (!current.dragged) current.changed = act('rotate');
        if (current.changed) save();
      }
      return true;
    }
    return false;
  }
  return {
    id: ID, frameInterval: 16,
    enter() { generation += 1; clearGesture(); },
    resize(viewport) { layout = createLayout(viewport); clearGesture(); },
    render(ctx) { return renderGame(ctx, layout, { round, best, paused, status: round.status, lastClear,
      storageAvailable: storageOK && services.storageAvailable !== false }); },
    tick(deltaMs) {
      if (!playing() || !Number.isFinite(deltaMs) || deltaMs <= 0) return;
      const dt = Math.min(deltaMs, MAX_FRAME);
      clearMs = Math.max(0, clearMs - dt); if (!clearMs) lastClear = 0;
      const groundedBefore = dropDistance(round) === 0;
      fallMs += dt;
      const interval = gravityInterval(round.level);
      while (fallMs >= interval) {
        fallMs -= interval;
        if (!move(round, 0, 1)) { fallMs = 0; break; }
      }
      if (dropDistance(round) === 0) {
        if (groundedBefore) lockMs += dt;
        if (lockMs >= LOCK_DELAY) { finishLock(lockPiece(round)); return; }
      }
      saveMs += dt;
      if (saveMs >= 1000) save();
    },
    activate, pointer, pause, save,
    sharePayload() { return { title: '一起来玩俄罗斯方块 · 花自飘零的游戏空间', query: `g=${ID}` }; },
    getResumeInfo() { return { text: `${round.score} 分 · ${round.lines} 行 · ${round.level} 级`, available: round.status === 'playing' }; },
    get model() { return { round, best, paused, status: round.status, lastClear, fallMs, lockMs, lockResets }; },
    get layout() { return layout; },
    get musicActive() { return playing(); },
    get statusText() { return `俄罗斯方块 · ${round.score} 分 · ${round.lines} 行 · ${round.level} 级 · ${round.status === 'over' ? '本局结束' : paused ? '已暂停' : '下落中'}`; },
    dispose() { pause(); disposed = true; },
  };
}

module.exports = { createGame, SAVE_KEY, LOCK_DELAY, MAX_LOCK_RESETS, MAX_FRAME, gravityInterval };
