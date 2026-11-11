'use strict';

const { saveKey } = require('../../platform/storage.js');
const { LEVELS, MAX_MOVES, newRound, move, undo, cloneRound, validateRound } = require('./engine.js');
const { createLayout, renderGame } = require('./renderer.js');
const ID = 'huarongdao';
const SAVE_KEY = saveKey(ID);
const DIRECTIONS = Object.freeze({ left: [-1, 0], right: [1, 0], up: [0, -1], down: [0, 1] });

function createGame({ read = () => null, write = () => false, services = {} } = {}) {
  let saved;
  try { saved = read(SAVE_KEY); } catch {}
  const restored = saved && saved.version === 1 ? validateRound(saved.round) : null;
  let round = restored || newRound('beginner');
  let paused = Boolean(restored && round.status === 'playing'), disposed = false, storageOK = true;
  let elapsedMs = restored && Number.isSafeInteger(saved.elapsedMs) && saved.elapsedMs >= 0 ? saved.elapsedMs : 0;
  let started = Boolean(restored && (saved.started === true || round.moves.length > 0 || elapsedMs > 0));
  let generation = 0, selected = null, saveMs = 0;
  const best = {};
  for (const level of LEVELS) {
    const value = saved && saved.best && saved.best[level.id];
    best[level.id] = Number.isInteger(value) && value > 0 && value <= MAX_MOVES ? value : null;
  }
  let layout = createLayout({ width: 375, height: 750, safeTop: 24, safeBottom: 0 });
  let gesture = null;
  const pointers = new Set();
  const playing = () => !disposed && !paused && round.status === 'playing';
  const clearGesture = () => { gesture = null; pointers.clear(); };
  const invalidate = () => { if (services.invalidate) services.invalidate(); };
  const toast = value => { if (services.toast) services.toast(value); };
  const levelTitle = () => LEVELS.find(level => level.id === round.levelId).title;
  function save() {
    if (disposed) return false;
    try { storageOK = write(SAVE_KEY, { version: 1, round: cloneRound(round), best: { ...best }, elapsedMs, started }) !== false; }
    catch { storageOK = false; }
    saveMs = 0; return storageOK;
  }
  function pause() { generation += 1; if (round.status === 'playing') paused = true; clearGesture(); save(); }
  function movePiece(id, direction) {
    if (!playing() || !Object.hasOwn(DIRECTIONS, direction)) return false;
    if (round.moves.length >= MAX_MOVES) { toast('本局步数已达上限，可悔棋或重开'); return false; }
    const [dx, dy] = DIRECTIONS[direction];
    if (!move(round, id, dx, dy)) return false;
    generation += 1; selected = id; started = true;
    if (round.status === 'won') {
      best[round.levelId] = Math.min(best[round.levelId] === null ? Infinity : best[round.levelId], round.moves.length);
      clearGesture();
    }
    save(); return true;
  }
  function startNew(levelId) {
    generation += 1; round = newRound(levelId); selected = null;
    paused = false; elapsedMs = 0; started = false; clearGesture(); save(); invalidate(); return true;
  }
  function requestNew(levelId) {
    if (!LEVELS.some(level => level.id === levelId)) return false;
    if (round.status === 'won' || round.moves.length === 0) return startNew(levelId);
    pause(); const expected = generation;
    const config = {
      title: levelId === round.levelId ? '重新开始华容道？' : '切换华容道关卡？',
      content: '当前局面将被替换，各关本机最佳步数会保留。取消后可点击继续保留当前进度。',
      confirmText: '开始新局', cancelText: '保留进度',
      fail: () => { if (!disposed && generation === expected) toast('暂时无法确认，请稍后再试'); },
    };
    try {
      if (!services.modal || services.modal(config, () => { if (!disposed && generation === expected) startNew(levelId); }) === false) toast('暂时无法确认，请稍后再试');
    } catch { toast('暂时无法确认，请稍后再试'); }
    return true;
  }
  function chooseLevel() {
    const wasPaused = paused;
    pause(); const expected = generation;
    let settled = false;
    const valid = () => !settled && !disposed && generation === expected;
    const restore = () => { settled = true; generation += 1; paused = wasPaused; clearGesture(); invalidate(); };
    const fail = result => {
      if (!valid()) return;
      restore();
      if (!result || !/cancel/i.test(String(result.errMsg || ''))) toast('关卡菜单暂时无法打开，请稍后再试');
    };
    try {
      if (!services.actionSheet || services.actionSheet({
        itemList: LEVELS.map(level => level.title),
        success: result => {
          if (!valid()) return;
          const choice = result && Number.isInteger(result.tapIndex) && LEVELS[result.tapIndex];
          if (!choice || choice.id === round.levelId) { restore(); return; }
          settled = true; requestNew(choice.id);
        }, fail,
      }) === false) fail();
    } catch { fail(); }
    return true;
  }
  function activate(action, payload) {
    if (disposed) return false;
    if (action === `${ID}:select`) {
      if (!playing() || !round.pieces.some(piece => piece.id === payload)) return false;
      clearGesture(); selected = payload; return true;
    }
    if (action === `${ID}:move`) { clearGesture(); return movePiece(selected, payload); }
    if (action === `${ID}:undo`) {
      if (paused || !undo(round)) return false;
      generation += 1; selected = null; clearGesture(); save(); return true;
    }
    if (action === `${ID}:pause` && playing()) { pause(); return true; }
    if (action === `${ID}:resume` && paused && round.status === 'playing') { generation += 1; paused = false; clearGesture(); return true; }
    if (action === `${ID}:new`) return requestNew(round.levelId);
    if (action === `${ID}:level`) return payload === undefined ? chooseLevel() : requestNew(payload);
    if (action === `${ID}:help`) {
      pause();
      const config = { title: '华容道 · 玩法',
        content: '让最大的“曹操”棋块移动到棋盘底部中央的出口位置，即可过关。棋块只能上下左右平移，不能旋转、重叠或穿过其他棋块。\n\n拖动棋块，或先点选棋块再点击方向按钮。每移动一格计1步，连续滑动两格计2步；悔棋撤回一格。\n\n提供入门、进阶和经典三个开局。用“换关”选择；重开或换关前会确认替换当前进度。每关最佳步数分别保留。\n\n首次移动后开始计时；暂停、返回大厅、分享或切到后台都会暂停。进度自动保存在本机，回来后手动继续。',
        showCancel: false, confirmText: '知道了', fail: () => { if (!disposed) toast('玩法暂时无法打开，请稍后再试'); } };
      try { if (!services.modal || services.modal(config) === false) toast('玩法暂时无法打开，请稍后再试'); }
      catch { toast('玩法暂时无法打开，请稍后再试'); }
      return true;
    }
    return false;
  }
  const pointId = p => p.identifier === undefined ? (p.id === undefined ? 0 : p.id) : p.identifier;
  const position = p => ({ x: Number(p.clientX === undefined ? p.x : p.clientX), y: Number(p.clientY === undefined ? p.y : p.clientY) });
  function updateDrag(point) {
    const current = gesture;
    if (!current) return false;
    const p = position(point), cell = layout.board.w / 4;
    if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) { clearGesture(); return false; }
    const dx = p.x - current.x, dy = p.y - current.y;
    if (!current.axis) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) < cell * 0.55) return true;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < Math.min(Math.abs(dx), Math.abs(dy)) * 1.15) return true;
      current.axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
    }
    const delta = current.axis === 'x' ? dx : dy;
    const sign = delta > 0 ? 1 : -1;
    const count = Math.min(5, Math.floor(Math.abs(delta) / cell + 0.45));
    const direction = current.axis === 'x' ? sign > 0 ? 'right' : 'left' : sign > 0 ? 'down' : 'up';
    for (let i = 0; i < count; i += 1) {
      if (!movePiece(current.pieceId, direction)) {
        current[current.axis] = p[current.axis]; break;
      }
      current[current.axis] += sign * cell;
      if (!gesture) break;
    }
    return true;
  }
  function pointer(type, points = []) {
    if (disposed) return false;
    if (type === 'cancel') { const had = Boolean(gesture); clearGesture(); return had; }
    if (!playing()) { clearGesture(); return false; }
    const list = Array.isArray(points) ? points.filter(p => p && typeof p === 'object') : [];
    if (type === 'start') {
      for (const p of list) pointers.add(pointId(p));
      if (list.length !== 1 || pointers.size !== 1 || gesture) { gesture = null; return false; }
      const p = position(list[0]), b = layout.board, cell = b.w / 4;
      if (!Number.isFinite(p.x) || !Number.isFinite(p.y) || p.x < b.x || p.x >= b.x + b.w || p.y < b.y || p.y >= b.y + b.h) return false;
      const x = Math.floor((p.x - b.x) / cell), y = Math.floor((p.y - b.y) / cell);
      const piece = round.pieces.find(item => x >= item.x && x < item.x + item.w && y >= item.y && y < item.y + item.h);
      selected = piece ? piece.id : null;
      if (!piece) return true;
      gesture = { id: pointId(list[0]), pieceId: piece.id, x: p.x, y: p.y, axis: null };
      return true;
    }
    if (type === 'move' || type === 'end') {
      const tracked = gesture && list.find(p => pointId(p) === gesture.id);
      if (type === 'end') for (const point of list) pointers.delete(pointId(point));
      if (!gesture || !tracked || list.length !== 1 || (type === 'end' && pointers.size > 0)) { gesture = null; return false; }
      const result = updateDrag(tracked);
      if (type === 'end') gesture = null;
      return result;
    }
    return false;
  }
  return {
    id: ID, frameInterval: 100,
    enter() { generation += 1; clearGesture(); },
    resize(viewport) { layout = createLayout(viewport); clearGesture(); },
    render(ctx) { return renderGame(ctx, layout, { round, selected, paused, best, elapsedMs,
      storageAvailable: storageOK && services.storageAvailable !== false }); },
    tick(deltaMs) {
      if (!playing() || !started || !Number.isFinite(deltaMs) || deltaMs <= 0) return;
      const dt = Math.min(Math.floor(deltaMs), 1000);
      elapsedMs = Math.min(Number.MAX_SAFE_INTEGER, elapsedMs + dt); saveMs += dt;
      if (saveMs >= 5000) save();
    },
    activate, pointer, pause, save,
    sharePayload() { return { title: '一起来挑战华容道 · 花自飘零的游戏空间', query: `g=${ID}` }; },
    getResumeInfo() { return { text: `${levelTitle()} · ${round.moves.length} 步${round.status === 'won' ? ' · 已通关' : ''}`, available: round.status === 'playing' && started }; },
    get model() { return { round, selected, paused, best, elapsedMs, started, status: round.status }; },
    get layout() { return layout; },
    get musicActive() { return playing() && started; },
    get statusText() { return `华容道 · ${levelTitle()} · ${round.moves.length} 步 · ${round.status === 'won' ? '曹操已脱困' : paused ? '已暂停' : selected ? '移动选中棋块' : '请选择棋块'}`; },
    dispose() { pause(); disposed = true; },
  };
}

module.exports = { createGame, SAVE_KEY, DIRECTIONS };
