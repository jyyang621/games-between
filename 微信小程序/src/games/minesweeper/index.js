'use strict';

const { saveKey } = require('../../platform/storage.js');
const { DIFFICULTIES, createRound, reveal, toggleFlag, chord, cloneRound, validateRound } = require('./engine.js');
const { createLayout, renderGame } = require('./renderer.js');

const ID = 'minesweeper';
const SAVE_KEY = saveKey(ID);
const MAX_TIME = 31536000000;

function createGame({ read = () => null, write = () => false, now = Date.now, services = {} } = {}) {
  let saved = null;
  try { saved = read(SAVE_KEY); } catch {}
  const compatible = saved && saved.version === 1;
  const candidate = compatible ? validateRound(saved.round) : null;
  const restored = candidate && candidate.elapsedMs <= MAX_TIME ? candidate : null;
  const bests = {};
  for (const difficulty of DIFFICULTIES) {
    const value = compatible && saved.bests && saved.bests[difficulty.id];
    bests[difficulty.id] = typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= MAX_TIME ? value : null;
  }
  let counter = 0;
  const seed = () => ((Number(now()) >>> 0) ^ Math.imul(++counter, 2654435761)) >>> 0;
  let round = restored || createRound('beginner', seed());
  if (round.status === 'won' && (bests[round.difficulty] === null || round.elapsedMs < bests[round.difficulty])) bests[round.difficulty] = round.elapsedMs;
  let mode = compatible && saved.mode === 'flag' ? 'flag' : 'reveal';
  let paused = Boolean(restored && (round.status === 'ready' || round.status === 'playing'));
  let viewport = { width: 375, height: 750, safeTop: 24, safeBottom: 0 };
  let layout = createLayout(viewport, round);
  let generation = 0, disposed = false, storageOK = true;

  const live = () => round.status === 'ready' || round.status === 'playing';
  const invalidate = () => { if (services.invalidate) services.invalidate(); };
  const relayout = () => { layout = createLayout(viewport, round); };
  function save() {
    if (disposed) return false;
    try { storageOK = write(SAVE_KEY, { version: 1, round: cloneRound(round), bests: { ...bests }, mode }) !== false; }
    catch { storageOK = false; }
    return storageOK;
  }
  function pause() {
    generation += 1;
    if (live()) paused = true;
  }
  function startNew(difficulty) {
    generation += 1;
    round = createRound(difficulty, seed()); paused = false; mode = 'reveal';
    relayout(); save(); invalidate(); return true;
  }
  function requestNew(difficulty) {
    if (!DIFFICULTIES.some(item => item.id === difficulty)) return false;
    if (live() && (round.started || round.flags.some(Boolean))) {
      pause();
      const expected = generation;
      if (!services.modal) {
        if (services.toast) services.toast('暂时无法确认重开，请稍后再试');
        return true;
      }
      services.modal({
        title: difficulty === round.difficulty ? '重新开始扫雷？' : '切换扫雷难度？',
        content: '当前棋盘将被替换，各难度的最佳用时会保留。',
        confirmText: '开始新局', cancelText: '保留进度',
      }, () => { if (!disposed && generation === expected) startNew(difficulty); });
      return true;
    }
    return startNew(difficulty);
  }
  function cell(index) {
    if (paused || !live() || !Number.isInteger(index) || index < 0 || index >= round.rows * round.cols) return false;
    const changed = mode === 'flag' ? toggleFlag(round, index) : round.revealed[index] ? chord(round, index) : reveal(round, index);
    if (!changed) return false;
    if (round.status === 'won' && (bests[round.difficulty] === null || round.elapsedMs < bests[round.difficulty])) bests[round.difficulty] = round.elapsedMs;
    generation += 1; save(); return true;
  }
  function activate(action, payload) {
    if (disposed) return false;
    if (action === ID + ':cell') return cell(payload);
    if (action === ID + ':mode' && !paused && live() && ['reveal', 'flag'].includes(payload) && payload !== mode) {
      mode = payload; generation += 1; save(); return true;
    }
    if (action === ID + ':pause' && !paused && live()) { pause(); save(); return true; }
    if (action === ID + ':resume' && paused && live()) { generation += 1; paused = false; return true; }
    if (action === ID + ':new') return requestNew(round.difficulty);
    if (action === ID + ':difficulty' && payload !== round.difficulty) return requestNew(payload);
    if (action === ID + ':help') {
      pause();
      if (services.modal) services.modal({
        title: '扫雷 · 玩法',
        content: '点击“翻开”后轻点格子。数字表示周围八格的地雷数量；空白区域会自动展开。\n\n首次翻开的格子及周围一圈不会有雷。普通随机棋盘可能需要猜测。\n\n切换到“插旗”，点击未翻开的格子可插旗或取消；插旗不会自动判定正确。切回“翻开”继续排查。\n\n在“翻开”模式点击已翻开的数字：若周围旗数与数字相同，会展开其余相邻格。插错旗仍可能触雷。\n\n翻开全部非雷格即获胜，无需插满旗。首次翻开后开始计时，各难度分别记录最佳用时。\n\n进度自动保存在本机。暂停、返回大厅或切到后台会停止计时，回来后点击“继续”。',
        showCancel: false, confirmText: '知道了',
      });
      return true;
    }
    return false;
  }
  return {
    id: ID, frameInterval: 250,
    enter() { generation += 1; },
    resize(next) { viewport = next; relayout(); },
    render(ctx) { return renderGame(ctx, layout, { round, bests, mode, paused, storageAvailable: storageOK && services.storageAvailable !== false }); },
    tick(deltaMs) {
      if (!disposed && !paused && round.status === 'playing' && Number.isFinite(deltaMs) && deltaMs > 0) round.elapsedMs = Math.min(MAX_TIME, round.elapsedMs + deltaMs);
    },
    activate, pointer() { return false; }, pause, save,
    sharePayload() { return { title: '一起来玩扫雷 · 花自飘零的游戏空间', query: 'g=' + ID }; },
    getResumeInfo() {
      const difficulty = DIFFICULTIES.find(item => item.id === round.difficulty);
      const flags = round.flags.filter(Boolean).length;
      return { text: difficulty.label + ' · ' + Math.floor(round.elapsedMs / 1000) + ' 秒 · 已标 ' + flags + '/' + round.mineCount,
        available: live() && (round.started || flags > 0) };
    },
    get model() { return { round, bests: { ...bests }, paused, mode, status: round.status }; },
    get layout() { return layout; },
    get musicActive() { return !disposed && !paused && round.status === 'playing'; },
    get statusText() {
      const difficulty = DIFFICULTIES.find(item => item.id === round.difficulty);
      return '扫雷 · ' + difficulty.label + ' · ' + Math.floor(round.elapsedMs / 1000) + ' 秒 · ' +
        (round.status === 'won' ? '排雷成功' : round.status === 'lost' ? '触雷了' : paused ? '已暂停' : mode === 'flag' ? '插旗模式' : round.started ? '翻开模式' : '首步安全，轻点开始');
    },
    dispose() { pause(); disposed = true; },
  };
}

module.exports = { createGame, SAVE_KEY, MAX_TIME };
